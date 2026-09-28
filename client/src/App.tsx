import { useEffect, useState } from "react";
import { Home, type GameSetup } from "./pages/Home";
import { LocalGame } from "./pages/LocalGame";
import { OnlineRoom } from "./pages/OnlineRoom";

type Screen = { kind: "home" } | { kind: "local"; setup: GameSetup } | { kind: "online"; code: string };

/** Online rooms have their own address, /room/K7QX, so an invite link opens the room directly. */
function screenFromAddress(): Screen {
  const match = /^\/room\/([A-Za-z0-9]{4,8})\/?$/.exec(window.location.pathname);
  return match ? { kind: "online", code: match[1].toUpperCase() } : { kind: "home" };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(screenFromAddress);

  // Keep the screen in step with the browser's back and forward buttons.
  useEffect(() => {
    const onAddressChange = () => setScreen(screenFromAddress());
    window.addEventListener("popstate", onAddressChange);
    return () => window.removeEventListener("popstate", onAddressChange);
  }, []);

  function goTo(address: string, next: Screen) {
    window.history.pushState(null, "", address);
    setScreen(next);
  }

  if (screen.kind === "local") {
    return (
      <LocalGame
        seats={screen.setup.seats}
        hideHands={screen.setup.hideHands}
        onExit={() => setScreen({ kind: "home" })}
      />
    );
  }
  if (screen.kind === "online") {
    return <OnlineRoom key={screen.code} code={screen.code} onLeave={() => goTo("/", { kind: "home" })} />;
  }
  return (
    <Home
      onStartLocal={(setup) => setScreen({ kind: "local", setup })}
      onEnterRoom={(code) => goTo(`/room/${code}`, { kind: "online", code })}
    />
  );
}
