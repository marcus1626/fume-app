import "@fume/ui/styles";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { watchForNewCode } from "./lib/newCode";
import { keepPictures } from "./lib/pictures";

watchForNewCode();
keepPictures();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
