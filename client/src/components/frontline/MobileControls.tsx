// FrontLine モバイルコントロール

function emitAction(action: string, value?: number) {
  window.dispatchEvent(
    new CustomEvent("frontline:mobile", {
      detail: { action, value },
    })
  );
}

const btnClass =
  "bg-white/10 rounded px-3 py-2 text-white text-xs font-mono select-none touch-manipulation active:bg-white/25 transition-colors";

export function MobileControls() {
  return (
    <div className="flex flex-row gap-2 justify-center py-2">
      {[1, 2, 3, 4].map(i => (
        <button
          key={i}
          type="button"
          className={btnClass}
          onTouchStart={e => {
            e.preventDefault();
            emitAction("weapon", i);
          }}
        >
          {i}
        </button>
      ))}
      <button
        type="button"
        className={btnClass}
        onTouchStart={e => {
          e.preventDefault();
          emitAction("reload");
        }}
      >
        R
      </button>
      <button
        type="button"
        className={btnClass}
        onTouchStart={e => {
          e.preventDefault();
          emitAction("defend");
        }}
        onTouchEnd={e => {
          e.preventDefault();
          emitAction("defendEnd");
        }}
        onTouchCancel={e => {
          e.preventDefault();
          emitAction("defendEnd");
        }}
      >
        防御
      </button>
    </div>
  );
}
