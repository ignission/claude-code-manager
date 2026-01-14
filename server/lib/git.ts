/**
 * Git Worktree Utilities
 * 
 * Provides safe wrappers around git worktree commands.
 * All paths are validated to prevent command injection.
 */

import { exec, execSync } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import type { Worktree } from "../../shared/types.js";

const execAsync = promisify(exec);

// Validate path to prevent command injection
function validatePath(inputPath: string): string {
  // Normalize and resolve the path
  const resolved = path.resolve(inputPath);
  
  // Check for dangerous characters
  if (/[;&|`$(){}[\]<>!]/.test(resolved)) {
    throw new Error("Invalid characters in path");
  }
  
  return resolved;
}

// Validate branch name
function validateBranchName(branch: string): string {
  // Git branch naming rules
  if (!/^[a-zA-Z0-9._\-/]+$/.test(branch)) {
    throw new Error("Invalid branch name");
  }
  
  // Prevent dangerous patterns
  if (branch.startsWith("-") || branch.includes("..")) {
    throw new Error("Invalid branch name pattern");
  }
  
  return branch;
}

// Check if a directory is a git repository
export async function isGitRepository(dirPath: string): Promise<boolean> {
  const safePath = validatePath(dirPath);
  
  try {
    await execAsync("git rev-parse --is-inside-work-tree", {
      cwd: safePath,
    });
    return true;
  } catch {
    return false;
  }
}

// Get the root of the git repository
export async function getGitRoot(dirPath: string): Promise<string> {
  const safePath = validatePath(dirPath);
  
  const { stdout } = await execAsync("git rev-parse --show-toplevel", {
    cwd: safePath,
  });
  
  return stdout.trim();
}

// List all worktrees for a repository
export async function listWorktrees(repoPath: string): Promise<Worktree[]> {
  const safePath = validatePath(repoPath);
  
  // Check if it's a git repository
  if (!(await isGitRepository(safePath))) {
    throw new Error("Not a git repository");
  }
  
  const { stdout } = await execAsync("git worktree list --porcelain", {
    cwd: safePath,
  });
  
  const worktrees: Worktree[] = [];
  const lines = stdout.trim().split("\n");
  
  let current: Partial<Worktree> = {};
  
  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      current.path = line.substring(9);
      current.id = Buffer.from(current.path).toString("base64").replace(/[/+=]/g, "");
    } else if (line.startsWith("HEAD ")) {
      current.commit = line.substring(5);
    } else if (line.startsWith("branch ")) {
      // refs/heads/branch-name -> branch-name
      current.branch = line.substring(7).replace("refs/heads/", "");
    } else if (line === "bare") {
      current.isBare = true;
    } else if (line === "detached") {
      current.branch = "(detached)";
    } else if (line === "") {
      // End of worktree entry
      if (current.path) {
        worktrees.push({
          id: current.id || "",
          path: current.path,
          branch: current.branch || "unknown",
          commit: current.commit || "",
          isMain: worktrees.length === 0, // First worktree is main
          isBare: current.isBare || false,
        });
      }
      current = {};
    }
  }
  
  // Handle last entry if no trailing newline
  if (current.path) {
    worktrees.push({
      id: current.id || "",
      path: current.path,
      branch: current.branch || "unknown",
      commit: current.commit || "",
      isMain: worktrees.length === 0,
      isBare: current.isBare || false,
    });
  }
  
  return worktrees;
}

// Create a new worktree
export async function createWorktree(
  repoPath: string,
  branchName: string,
  baseBranch?: string
): Promise<Worktree> {
  const safePath = validatePath(repoPath);
  const safeBranch = validateBranchName(branchName);
  
  // Get the repository root
  const gitRoot = await getGitRoot(safePath);
  
  // Generate worktree path (sibling directory)
  const repoName = path.basename(gitRoot);
  const parentDir = path.dirname(gitRoot);
  const worktreePath = path.join(parentDir, `${repoName}-${safeBranch.replace(/\//g, "-")}`);
  
  // Check if path already exists
  if (fs.existsSync(worktreePath)) {
    throw new Error(`Directory already exists: ${worktreePath}`);
  }
  
  // Create the worktree with a new branch
  const baseRef = baseBranch ? validateBranchName(baseBranch) : "HEAD";
  
  await execAsync(`git worktree add -b "${safeBranch}" "${worktreePath}" ${baseRef}`, {
    cwd: gitRoot,
  });
  
  // Get the created worktree info
  const worktrees = await listWorktrees(gitRoot);
  const created = worktrees.find((w) => w.path === worktreePath);
  
  if (!created) {
    throw new Error("Failed to create worktree");
  }
  
  return created;
}

// Delete a worktree
export async function deleteWorktree(
  repoPath: string,
  worktreePath: string
): Promise<void> {
  const safePath = validatePath(repoPath);
  const safeWorktreePath = validatePath(worktreePath);
  
  // Get the repository root
  const gitRoot = await getGitRoot(safePath);
  
  // Verify the worktree exists
  const worktrees = await listWorktrees(gitRoot);
  const worktree = worktrees.find((w) => w.path === safeWorktreePath);
  
  if (!worktree) {
    throw new Error("Worktree not found");
  }
  
  if (worktree.isMain) {
    throw new Error("Cannot delete the main worktree");
  }
  
  // Remove the worktree
  await execAsync(`git worktree remove "${safeWorktreePath}" --force`, {
    cwd: gitRoot,
  });
  
  // Also delete the branch if it was created for this worktree
  try {
    await execAsync(`git branch -D "${worktree.branch}"`, {
      cwd: gitRoot,
    });
  } catch {
    // Branch might be used elsewhere, ignore error
  }
}

// Get list of branches
export async function listBranches(repoPath: string): Promise<string[]> {
  const safePath = validatePath(repoPath);
  
  const { stdout } = await execAsync("git branch -a --format='%(refname:short)'", {
    cwd: safePath,
  });
  
  return stdout
    .trim()
    .split("\n")
    .filter((b) => b && !b.startsWith("origin/HEAD"));
}
