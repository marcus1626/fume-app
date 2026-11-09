// The frame of the screens before Fume (sign-in.css): the lockup, one narrow column, a footer line, and a Fume Engine
// light study on the right, with no label (Marcus, 28 Oct 2026). Signing in and "About you" share it, so getting in
// reads as one place.
import { IconSprite } from "@fume/ui";
import type { ReactNode } from "react";
import { Lockup } from "../../shell/Logo";
import lightImage from "./sign-in-light.jpg";

export function SignInFrame({ children, foot }: { children: ReactNode; foot: ReactNode }) {
  return (
    <div className="ui-signin">
      <div className="ui-signin-side">
        <header className="ui-signin-top">
          <Lockup />
          <IconSprite />
        </header>
        <main id="main" className="ui-signin-body">
          {children}
        </main>
        <footer className="ui-signin-foot">{foot}</footer>
      </div>
      <div className="ui-signin-art">
        <div className="ui-signin-art-media">
          <img src={lightImage} alt="" />
        </div>
      </div>
    </div>
  );
}
