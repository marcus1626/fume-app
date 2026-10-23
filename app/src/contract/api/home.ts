// Home calls: each Home in one call.

import type { AgencyHomeView, AllBrandsView, HomeView } from "../views/home";

export interface HomeApi {
  /** The customer's Home. */
  home(): Promise<HomeView>;
  /** Fume's people: the "All brands" overview. */
  allBrands(): Promise<AllBrandsView>;
  /** The agency's Home: the clients as cards, what needs you, the team this week. */
  agencyHome(): Promise<AgencyHomeView>;
}
