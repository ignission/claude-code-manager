// client/src/components/pets/ArkPetsPage.tsx
import { useState } from "react";
import type { Pet, PetAction, PetGame } from "../../../../shared/types";
import { ArkShip } from "./ArkShip";
import { GameMenu } from "./GameMenu";
import { PetDetailPopover } from "./PetDetailPopover";

interface ArkPetsPageProps {
  pets: Pet[];
  totalLevel: number;
  onInteract: (petId: string, action: PetAction) => void;
  onRename: (petId: string, name: string) => void;
  onGameResult: (petId: string, game: PetGame, score: number) => void;
}

export function ArkPetsPage({
  pets,
  totalLevel,
  onInteract,
  onRename,
  onGameResult,
}: ArkPetsPageProps) {
  const [_selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showGame, setShowGame] = useState<{ pet: Pet; game: PetGame } | null>(
    null
  );

  const handlePetClick = (pet: Pet) => {
    setSelectedPet(pet);
  };

  if (pets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <div className="text-4xl">🚢</div>
          <p>箱舟はまだ空っぽです</p>
          <p className="text-xs">セッションを起動するとペットが生まれます</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
      {/* 箱舟ビュー */}
      <ArkShip
        pets={pets}
        totalLevel={totalLevel}
        onPetClick={handlePetClick}
      />

      {/* ゲームボタン */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (pets.length > 0) {
              setShowGame({ pet: pets[0], game: "feeding" });
            }
          }}
          className="text-sm px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          🎮 ミニゲーム
        </button>
      </div>

      {/* ペット一覧 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">乗組員</h3>
        <div className="grid grid-cols-1 gap-2">
          {pets.map(pet => (
            <button
              key={pet.id}
              type="button"
              onClick={() => setSelectedPet(pet)}
              className="w-full p-2 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors text-left"
            >
              <PetDetailPopover
                pet={pet}
                onPet={() => onInteract(pet.id, "pet")}
                onFeed={() => onInteract(pet.id, "feed")}
                onRename={name => onRename(pet.id, name)}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ゲームメニュー（モーダル） */}
      {showGame && (
        <GameMenu
          pet={showGame.pet}
          onSelectGame={game => setShowGame({ ...showGame, game })}
          onGameResult={score => {
            onGameResult(showGame.pet.id, showGame.game, score);
            setShowGame(null);
          }}
          onClose={() => setShowGame(null)}
        />
      )}
    </div>
  );
}
