// Who makes a fix asked for in Check. With the mock, the Engine does; on the live backend this week, Fume's designer
// does it by hand in the Studio (the Engine is its own track), so Check names the designer, not the Engine.
const byHand = import.meta.env.VITE_FUME_API === "supabase";

export const fixer = byHand
  ? {
      tell: "Ask for a fix",
      withIt: "With the designer",
      withItLower: "with the designer",
      fixed: "the designer fixed it",
      fixBack: "The fix is back",
      fixing: "The designer is fixing it",
      said: "Asked for",
      didntGet: "The fix wasn’t asked for",
      landsHere: "What Fume makes lands here first",
    }
  : {
      tell: "Tell the Engine",
      withIt: "With the Engine",
      withItLower: "with the Engine",
      fixed: "the Engine fixed it",
      fixBack: "The Engine’s fix is back",
      fixing: "The Engine is fixing it",
      said: "Said to the Engine",
      didntGet: "The Engine didn’t get it",
      landsHere: "What the Engine makes lands here first",
    };
