// Typed hooks over FumeApi, one per call. Query keys are the cache's names; mutations refresh what they change.
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { CampaignFilter, ChangeTag, CustomerRole, FumeApi, Id, Pin, QaPin } from "../contract";
import { useApi } from "./client";

const q = <T>(key: QueryKey, fn: (api: FumeApi) => Promise<T>, enabled = true) => {
  const api = useApi();
  return useQuery({ queryKey: key, queryFn: () => fn(api), enabled });
};

/** A mutation that refreshes everything once it lands: the mock is small, and the real backend sends events. */
const m = <A, R>(fn: (api: FumeApi, args: A) => Promise<R>) => {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({ mutationFn: (args: A) => fn(api, args), onSuccess: () => client.invalidateQueries() });
};

// Session and home
export const useSession = () => q(["session"], (a) => a.session());
export const useHome = () => q(["home"], (a) => a.home());

// Brand DNA
export const useBrandDna = () => q(["brand"], (a) => a.brandDna());
export const useProduct = (id: Id) => q(["product", id], (a) => a.product(id));
export const useVerifyFact = () => m((a, factId: Id) => a.verifyFact(factId));
export const useCorrectFact = () => m((a, v: { factId: Id; statement: string }) => a.correctFact(v.factId, v.statement));
export const useVerifyProduct = () => m((a, id: Id) => a.verifyProduct(id));
export const useChooseTastePair = () => m((a, v: { pairId: Id; chosen: "a" | "b"; reason?: string }) => a.chooseTastePair(v.pairId, v.chosen, v.reason));
export const useAnswerUnderstanding = () => m((a, v: Parameters<FumeApi["answerUnderstanding"]>[0]) => a.answerUnderstanding(v));
export const useApproveBrandDna = () => m((a, _: void) => a.approveBrandDna());
export const useUploadAssets = () => m((a, files: Parameters<FumeApi["uploadSourceAssets"]>[0]) => a.uploadSourceAssets(files));
export const useAddReference = () => m((a, v: Parameters<FumeApi["addReference"]>[0]) => a.addReference(v));

// Campaigns
export const useCampaigns = (filter?: CampaignFilter) => q(["campaigns", filter], (a) => a.campaigns(filter));
export const useCampaign = (id: Id | undefined) => q(["campaign", id], (a) => a.campaign(id!), Boolean(id));
export const useCreative = (id: Id | undefined) => q(["creative", id], (a) => a.creative(id!), Boolean(id));
export const useStartCampaign = () => m((a, v: { text: string }) => a.startCampaign(v));
export const useApproveBrief = () => m((a, campaignId: Id) => a.approveBrief(campaignId));
export const useChooseDirection = () => m((a, v: { directionId: Id; reason?: string }) => a.chooseDirection(v.directionId, v.reason));
export const usePassDirections = () => m((a, v: { campaignId: Id; reason: string }) => a.passDirections(v.campaignId, v.reason));

// Review
export const useReviewQueue = () => q(["review"], (a) => a.reviewQueue());
export const useApprove = () => m((a, versionIds: Id[]) => a.approve(versionIds));
export const useRequestChanges = () => m((a, v: { versionId: Id; pins: Pin[]; tags: ChangeTag[]; text: string }) => a.requestChanges(v));

// Deliveries
export const useDeliveries = () => q(["deliveries"], (a) => a.deliveries());
export const useDelivery = (id: Id | undefined) => q(["delivery", id], (a) => a.delivery(id!), Boolean(id));
export const useConfirmLive = () => m((a, id: Id) => a.confirmLive(id));

// Fume
export const useThreads = () => q(["threads"], (a) => a.threads());
export const useMessages = (threadId: Id | undefined) => q(["messages", threadId], (a) => a.messages(threadId!), Boolean(threadId));
export const useSend = () => m((a, v: { threadId: Id; text: string; attachments?: { name: string; bytes: number }[] }) => a.send(v.threadId, v.text, v.attachments));

// Team and settings
export const useTeam = () => q(["team"], (a) => a.team());
export const usePeople = () => q(["people"], (a) => a.people());
export const useInvite = () => m((a, v: { email: string; role: CustomerRole }) => a.invite(v.email, v.role));
export const useChangeRole = () => m((a, v: { userId: Id; role: CustomerRole }) => a.changeRole(v.userId, v.role));
export const useRemoveMember = () => m((a, userId: Id) => a.removeMember(userId));
export const useSettings = () => q(["settings"], (a) => a.settings());
export const useUpdateWorkspace = () => m((a, v: Parameters<FumeApi["updateWorkspace"]>[0]) => a.updateWorkspace(v));

// Notifications
export const useNotifications = () => q(["notifications"], (a) => a.notifications());
export const useMarkRead = () => m((a, ids: Id[] | "all") => a.markRead(ids));

// Studio
export const useCheckQueue = () => q(["studio", "queue"], (a) => a.checkQueue());
export const useCheck = (id: Id | undefined) => q(["studio", "check", id], (a) => a.check(id!), Boolean(id));
export const usePassItem = () => m((a, v: { checkId: Id; itemId: Id }) => a.passItem(v.checkId, v.itemId));
export const useAddNote = () => m((a, v: { checkId: Id; x: number; y: number; text: string; itemId?: Id }) => a.addNote(v.checkId, v));
export const useMarkChecked = () => m((a, checkId: Id) => a.markChecked(checkId));
export const useRequestCorrection = () => m((a, checkId: Id) => a.requestCorrection(checkId));
export const useHold = () => m((a, v: { checkId: Id; reason: string }) => a.hold(v.checkId, v.reason));
export const useRelease = () => m((a, campaignId: Id) => a.release(campaignId));
export const useStudioCampaigns = () => q(["studio", "campaigns"], (a) => a.studioCampaigns());
export const useQualityLog = () => q(["studio", "quality"], (a) => a.qualityLog());
export const useTeamLoad = () => q(["studio", "team"], (a) => a.teamLoad());

// ─── v2 (FLOWS.md) ───
// Onboarding scan
export const useBrandScan = () => q(["scan"], (a) => a.brandScan());
export const useStartBrandScan = () => m((a, v: Parameters<FumeApi["startBrandScan"]>[0]) => a.startBrandScan(v));
// Brand DNA board
export const useBrandBoard = () => q(["brand", "board"], (a) => a.brandBoard());
export const useDecide = () => m((a, v: Parameters<FumeApi["decide"]>[0]) => a.decide(v));
// Catalogue
export const useCatalogue = () => q(["catalogue"], (a) => a.catalogue());
export const useCollection = (id: Id | undefined) => q(["collection", id], (a) => a.collection(id!), Boolean(id));
export const useAddCollection = () => m((a, v: Parameters<FumeApi["addCollection"]>[0]) => a.addCollection(v));
export const useSetProductPlace = () => m((a, v: { productId: Id; categoryId?: Id; collectionIds?: Id[] }) => a.setProductPlace(v.productId, v));
// Boards
export const useBoards = () => q(["boards"], (a) => a.boards());
export const useBoard = (id: Id | undefined) => q(["board", id], (a) => a.board(id!), Boolean(id));
export const useAddBoardItem = () => m((a, v: { boardId: Id; item: Parameters<FumeApi["addBoardItem"]>[1] }) => a.addBoardItem(v.boardId, v.item));
export const useUpdateBoardItem = () => m((a, v: { boardId: Id; itemId: Id; change: Parameters<FumeApi["updateBoardItem"]>[2] }) => a.updateBoardItem(v.boardId, v.itemId, v.change));
export const useRemoveBoardItem = () => m((a, v: { boardId: Id; itemId: Id }) => a.removeBoardItem(v.boardId, v.itemId));
// Campaign scope and deliveries per collection
export const useSetCampaignScope = () => m((a, v: { campaignId: Id; productIds: Id[]; collectionIds: Id[] }) => a.setCampaignScope(v.campaignId, v));
export const useMakeDelivery = () => m((a, v: { campaignId: Id; collectionId?: Id }) => a.makeDelivery(v));
// Fume's people: switcher levels and the Studio
export const useAllBrands = () => q(["studio", "all"], (a) => a.allBrands());
export const useBrandWorkspace = (id: Id | undefined) => q(["studio", "brand", id], (a) => a.brandWorkspace(id!), Boolean(id));
export const useStudioKit = (workspaceId: Id | undefined) => q(["studio", "kit", workspaceId], (a) => a.studioKit(workspaceId!), Boolean(workspaceId));
export const useStudioSession = (id: Id | undefined) => q(["studio", "session", id], (a) => a.studioSession(id!), Boolean(id));
export const useOpenStudio = () => m((a, v: Parameters<FumeApi["openStudio"]>[0]) => a.openStudio(v));
export const useGenerate = () => m((a, v: { sessionId: Id; recipe: Parameters<FumeApi["generate"]>[1] }) => a.generate(v.sessionId, v.recipe));
export const useRepair = () => m((a, v: { sessionId: Id; generationId: Id; what: string }) => a.repair(v.sessionId, v.generationId, v.what));
export const usePickGeneration = () => m((a, v: { sessionId: Id; generationId: Id }) => a.pickGeneration(v.sessionId, v.generationId));
export const useSendToCheck = () => m((a, sessionId: Id) => a.sendToCheck(sessionId));

// ─── v3 (FLOWS §9–§14) ───
// Studio documents
export const useStudioModes = () => q(["studio", "modes"], (a) => a.studioModes());
export const useDocuments = (workspaceId: Id | undefined) => q(["studio", "documents", workspaceId], (a) => a.documents(workspaceId!), Boolean(workspaceId));
export const useDocument = (id: Id | undefined) => q(["studio", "document", id], (a) => a.document(id!), Boolean(id));
export const useOpenDocument = () => m((a, v: Parameters<FumeApi["openDocument"]>[0]) => a.openDocument(v));
export const useUpdateDocument = () => m((a, v: { documentId: Id; change: Parameters<FumeApi["updateDocument"]>[1] }) => a.updateDocument(v.documentId, v.change));
export const useEngineEdit = () => m((a, v: { documentId: Id; text: string }) => a.engineEdit(v.documentId, v.text));
export const useDecideEdit = () => m((a, v: { documentId: Id; editId: Id; verdict: "keep" | "undo" }) => a.decideEdit(v.documentId, v.editId, v.verdict));
export const useRender = () => m((a, documentId: Id) => a.render(documentId));
export const usePickVersion = () => m((a, v: { documentId: Id; versionId: Id }) => a.pickVersion(v.documentId, v.versionId));
export const useOverrideProduct = () => m((a, v: { documentId: Id; field: string; value: string; scope: "this_render" | "product" }) => a.overrideProduct(v.documentId, v));
export const useDocumentToCheck = () => m((a, documentId: Id) => a.documentToCheck(documentId));
// Brand assets
export const useBrandAssets = (workspaceId?: Id) => q(["assets", workspaceId ?? "mine"], (a) => a.brandAssets(workspaceId));
export const useSaveModel = () => m((a, v: Parameters<FumeApi["saveModel"]>[0]) => a.saveModel(v));
export const useDecideModel = () => m((a, v: { modelId: Id; verdict: "approve" | "decline" }) => a.decideModel(v.modelId, v.verdict));
export const useSaveReference = () => m((a, v: Parameters<FumeApi["saveReference"]>[0]) => a.saveReference(v));
export const useDecideOverride = () => m((a, v: { overrideId: Id; verdict: "approve" | "decline" }) => a.decideOverride(v.overrideId, v.verdict));
export const useProductProposals = (productId: Id | undefined) => q(["product", productId, "proposals"], (a) => a.productProposals(productId!), Boolean(productId));
// QA
export const useQaQueue = (workspaceId?: Id) => q(["studio", "qa", workspaceId ?? "all"], (a) => a.qaQueue(workspaceId));
export const useQaCheck = () => m((a, itemId: Id) => a.qaCheck(itemId));
export const useQaFeedback = () => m((a, v: { itemId: Id; text: string; pins?: QaPin[] }) => a.qaFeedback(v.itemId, v.text, v.pins)); // r13 #51: pins
export const useQaEdit = () => m((a, v: { itemId: Id; layers: Parameters<FumeApi["qaEdit"]>[1] }) => a.qaEdit(v.itemId, v.layers));
export const useQaToStudio = () => m((a, itemId: Id) => a.qaToStudio(itemId));
/** r13 #64: the designer takes the creative from the Engine (its fix stops). */
export const useQaTakeOver = () => m((a, itemId: Id) => a.qaToStudio(itemId, true));
// Review like frame.io
export const useReviewComments = (creativeId: Id | undefined) => q(["review", "comments", creativeId], (a) => a.reviewComments(creativeId!), Boolean(creativeId));
export const useAddReviewComment = () => m((a, v: Parameters<FumeApi["addReviewComment"]>[0]) => a.addReviewComment(v));
export const useResolveReviewComment = () => m((a, commentId: Id) => a.resolveReviewComment(commentId));
export const useRate = () => m((a, v: Parameters<FumeApi["rate"]>[0]) => a.rate(v));
export const useRatings = (campaignId: Id | undefined) => q(["review", "ratings", campaignId], (a) => a.ratings(campaignId!), Boolean(campaignId));
// Taste
export const useTasteTraining = () => q(["taste"], (a) => a.tasteTraining());
export const useAnswerTaste = () => m((a, v: Parameters<FumeApi["answerTaste"]>[0]) => a.answerTaste(v));
// One Fume chat and a brief without chat
export const useConversation = () => q(["conversation"], (a) => a.conversation());
export const useSay = () => m((a, v: { text: string; attachments?: { name: string; bytes: number }[] }) => a.say(v.text, v.attachments));
export const useOrderBrief = () => m((a, order: Parameters<FumeApi["orderBrief"]>[0]) => a.orderBrief(order));
// Batches
export const useBatches = (campaignId?: Id) => q(["studio", "batches", campaignId ?? "all"], (a) => a.batches(campaignId));
export const useStartBatch = () => m((a, v: Parameters<FumeApi["startBatch"]>[0]) => a.startBatch(v));

// ─── v4 (FLOWS §15–§21) ───
// Placements and Make formats
export const usePlacements = () => q(["placements"], (a) => a.placements());
export const useMakeFormats = () => m((a, v: { documentId: Id; placementIds: Id[] }) => a.makeFormats(v.documentId, v.placementIds));
export const useSetFormatTile = () => m((a, v: { documentId: Id; placementId: Id; change: Parameters<FumeApi["setFormatTile"]>[2] }) => a.setFormatTile(v.documentId, v.placementId, v.change));
// Product fix
export const useDetailTokens = (productId: Id | undefined) => q(["details", productId], (a) => a.detailTokens(productId!), Boolean(productId));
export const useFixProduct = () => m((a, v: { documentId: Id } & Parameters<FumeApi["fixProduct"]>[1]) => a.fixProduct(v.documentId, v));
// Light and camera
export const useLookPresets = (workspaceId: Id | undefined) => q(["looks", workspaceId], (a) => a.lookPresets(workspaceId!), Boolean(workspaceId));
export const useSetSource = () => m((a, v: { documentId: Id; section: string; source: Parameters<FumeApi["setSource"]>[2] }) => a.setSource(v.documentId, v.section, v.source));
// The Engine chat
export const useEngineChat = (workspaceId: Id | undefined) => q(["engine", "chat", workspaceId], (a) => a.engineChat(workspaceId!), Boolean(workspaceId));
export const useEngineSay = () => m((a, v: { workspaceId: Id; text: string }) => a.engineSay(v.workspaceId, v.text));
export const useAnswerEngineWidget = () => m((a, v: { workspaceId: Id; messageId: Id; picked?: Id[]; choice?: string }) => a.answerEngineWidget(v.workspaceId, v.messageId, v));
// Admin
export const useUsage = () => q(["usage"], (a) => a.usage());
// Meetings and the calendar
export const useMeetingSlots = () => q(["meetings", "slots"], (a) => a.meetingSlots());
export const useBookMeeting = () => m((a, v: { at: string; topic: string }) => a.bookMeeting(v));
export const useMeetings = () => q(["meetings"], (a) => a.meetings());
export const useCalendar = (from: string, to: string) => q(["calendar", from, to], (a) => a.calendar({ from, to }));
export const useSchedule = () => m((a, v: Parameters<FumeApi["schedule"]>[0]) => a.schedule(v));
export const useMoveEntry = () => m((a, v: { entryId: Id; at: string }) => a.moveEntry(v.entryId, v.at));
export const useRemoveEntry = () => m((a, entryId: Id) => a.removeEntry(entryId));

// v5: a campaign moodboard started on the spot (Marcus 15 Oct)
export const useStartMoodboard = () => m((a, v: { campaignId: Id; images: string[] }) => a.startMoodboard(v.campaignId, v.images));

// v6: product kinds and specs (round 6: a product category is a schema, like a Studio mode)
export const useProductKinds = () => q(["productKinds"], (a) => a.productKinds());
export const useReadProduct = () => m((a, v: Parameters<FumeApi["readProduct"]>[0]) => a.readProduct(v));
export const useSaveProductSpecs = () => m((a, v: { productId: Id } & Parameters<FumeApi["saveProductSpecs"]>[1]) => a.saveProductSpecs(v.productId, v));
export const useUploadShot = () => m((a, v: { productId: Id; slotId: Id; name: string; bytes: number; src?: string }) => a.uploadShot(v.productId, v.slotId, { name: v.name, bytes: v.bytes, src: v.src }));
export const useUploadProductFile = () => m((a, v: { productId: Id } & Parameters<FumeApi["uploadProductFile"]>[1]) => a.uploadProductFile(v.productId, v));

// The brief, line by line (walk-through 15 Oct, Must 12): a manual brief is finished where it is read.
export const useChangeBrief = () => m((a, v: { campaignId: Id; change: Parameters<FumeApi["changeBrief"]>[1] }) => a.changeBrief(v.campaignId, v.change));

// v9: Update the brand (round 7, PROPOSED 16 Oct 2026). The update is polled while the Engine reads.
export const useBrandUpdate = () => {
  const api = useApi();
  return useQuery({ queryKey: ["brandUpdate"], queryFn: () => api.brandUpdate(), refetchInterval: (query) => (query.state.data?.state === "reading" ? 700 : false) });
};
export const useStartBrandUpdate = () => m((a, v: Parameters<FumeApi["startBrandUpdate"]>[0]) => a.startBrandUpdate(v));
export const useDecideBrandFound = () => m((a, v: Parameters<FumeApi["decideBrandFound"]>[0]) => a.decideBrandFound(v));
export const useApproveBrandUpdate = () => m((a, updateId: Id) => a.approveBrandUpdate(updateId));

// v8: Import products (round 7, worker W): the import under way polls until it has something to show.
export const useProductImport = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["productImport"],
    queryFn: () => api.productImport(),
    refetchInterval: (query) => (query.state.data?.state === "reading" ? 600 : false),
  });
};
export const useStartProductImport = () => m((a, v: Parameters<FumeApi["startProductImport"]>[0]) => a.startProductImport(v));
export const useMapImportColumns = () => m((a, v: { jobId: Id; columns: Parameters<FumeApi["mapImportColumns"]>[1] }) => a.mapImportColumns(v.jobId, v.columns));
export const useDecideFound = () => m((a, v: { jobId: Id; foundId: Id; decision: Parameters<FumeApi["decideFound"]>[2] }) => a.decideFound(v.jobId, v.foundId, v.decision));
export const useApproveImport = () => m((a, jobId: Id) => a.approveImport(jobId));
export const useDismissImport = () => m((a, jobId: Id) => a.dismissImport(jobId));

// ── round 8 HOME ──
// One question, one sheet (features/questions/QuestionSheet.tsx): the open questions, and the one way to answer them.
export const useQuestions = () => q(["questions"], (a) => a.questions());
export const useAnswerQuestion = () => m((a, v: Parameters<FumeApi["answerQuestion"]>[0]) => a.answerQuestion(v));

// ── round 8 REVIEW ──
// Approve with Undo, and one change request for a review set (features/review).
export const useUnapprove = () => m((a, versionIds: Id[]) => a.unapprove(versionIds));
export const useRequestChangeRound = () => m((a, v: Parameters<FumeApi["requestChangeRound"]>[0]) => a.requestChangeRound(v));

// ── round 8 ONB ──
export const useOnboardingProgress = () => q(["onboarding"], (a) => a.onboardingProgress());
export const useSaveOnboardingProgress = () => m((a, v: Parameters<FumeApi["saveOnboardingProgress"]>[0]) => a.saveOnboardingProgress(v));

// ── round 9 VIEWER ──
// Undo for a change request just sent (DTSK-15), and several campaigns at once so a collection's approved work gets the
// same short names ("Feed A2") as on each campaign (DTSK-11, features/review/names.ts).
export const useWithdrawChangeRound = () => m((a, v: Parameters<FumeApi["withdrawChangeRound"]>[0]) => a.withdrawChangeRound(v));
export const useCampaignViews = (ids: Id[]) => q(["campaign-views", ...ids], (a) => Promise.all(ids.map((id) => a.campaign(id))), ids.length > 0);

// ── round 9 CHAT ──
// A brief half made in the Fume chat (DTSK-16): Home shows it as a Waiting row, "Christmas · Hand Balm · Fume asked who
// it should reach", which opens the chat at that question. One per campaign started in the chat whose newest word is
// Fume's open question (a brief that is complete waits on Home as the brief to approve instead). Composed from the
// conversation the chat already reads, so the row and the chat never disagree.
export interface DraftBrief {
  campaignId: Id;
  threadId: Id;
  /** The campaign's name so far ("Christmas"; "Christmas · Hand Balm" once the product is picked). */
  campaignName: string;
  /** The product it is for, or the one she named that waits to be confirmed ("Hand Balm"). */
  productName?: string;
  /** "Christmas · Hand Balm": the name, with the product when the name does not say it yet. */
  title: string;
  /** Fume's open question as Fume put it: "Who should it reach?". */
  question: string;
  /** The question as Home says it: "Fume asked who it should reach". */
  asked: string;
  /** The whole row: "Christmas · Hand Balm · Fume asked who it should reach". */
  line: string;
  /** The chat, at that question. */
  href: string;
  /** When Fume asked. */
  at: string;
}

/** "Who should it reach?" → "who it should reach"; "Which product is it for?" → "which product it is for". */
const askedAs = (question: string) => {
  const q = question.trim().replace(/[?.]+$/, "");
  const m = /^(who|what|when|where|how|which \S+)\s+(should|is|are|will|does|do|can|may)\s+(it|we|you|they)\s+(.+)$/i.exec(q);
  return m ? `${m[1].toLowerCase()} ${m[3]} ${m[2]} ${m[4]}` : q.charAt(0).toLowerCase() + q.slice(1);
};

export function useDraftBriefs(): { data: DraftBrief[] | undefined; isPending: boolean } {
  const campaigns = useCampaigns();
  const threads = useThreads();
  const conversation = useConversation();
  const catalogue = useCatalogue();
  if (!campaigns.data || !threads.data || !conversation.data) return { data: undefined, isPending: true };
  const products = catalogue.data?.products ?? [];
  const drafts: DraftBrief[] = [];
  for (const t of threads.data) {
    if (!t.campaignId || t.kind === "contact") continue;
    const campaign = campaigns.data.find((c) => c.id === t.campaignId);
    if (!campaign || campaign.state !== "draft") continue;
    const said = conversation.data.filter((m) => m.threadId === t.id);
    const newest = said[said.length - 1];
    if (!newest || newest.author.kind !== "fume" || newest.card?.kind !== "question") continue;
    // Only a campaign started in the chat: her own first words are in this conversation.
    if (!said.some((m) => m.author.kind === "person")) continue;
    const card = newest.card as import("../contract").ProductQuestionCard;
    const named = [...said].reverse().map((m) => (m.card?.kind === "question" ? (m.card as import("../contract").ProductQuestionCard).named : undefined)).find((n) => n?.length) ?? [];
    const names = products.filter((p) => campaign.productIds.includes(p.id)).map((p) => p.name);
    const productName = (names.length ? names : products.filter((p) => named.includes(p.id)).map((p) => p.name)).join(" and ") || undefined;
    const title = productName && !campaign.name.toLowerCase().includes(productName.toLowerCase()) ? `${campaign.name} · ${productName}` : campaign.name;
    const asked = `Fume asked ${askedAs(card.question)}`;
    drafts.push({ campaignId: campaign.id, threadId: t.id, campaignName: campaign.name, productName, title, question: card.question, asked, line: `${title} · ${asked}`, href: `/fume/${t.id}`, at: newest.at });
  }
  return { data: drafts.sort((a, b) => b.at.localeCompare(a.at)), isPending: false };
}

// ── round 10 the plan ──
// FLOWS §22: the plan Fume writes from the brief she sent; she approves it before the Engine makes anything.
export const usePlan = (campaignId: Id | undefined) => q(["plan", campaignId], (a) => a.plan(campaignId!), Boolean(campaignId));
export const useSendBrief = () => m((a, campaignId: Id) => a.sendBrief(campaignId));
export const useApprovePlan = () => m((a, campaignId: Id) => a.approvePlan(campaignId));
export const useUndoApprovePlan = () => m((a, campaignId: Id) => a.undoApprovePlan(campaignId));
export const useChangePlan = () => m((a, v: { campaignId: Id } & import("../contract").PlanChange) => {
  const { campaignId, ...change } = v;
  return a.changePlan(campaignId, change);
});
export const useChoosePlanDirection = () => m((a, v: { campaignId: Id; directionId: Id; reason?: string }) => a.choosePlanDirection(v.campaignId, v.directionId, v.reason));
export const useAskPlanChanges = () => m((a, v: { campaignId: Id; note: string }) => a.askPlanChanges(v.campaignId, v.note));
export const useCheckPlan = () => m((a, campaignId: Id) => a.checkPlan(campaignId));

// ── round 10 FLOW ──
// The plans of several campaigns at once (⌘K, Home's plan rows), like useCampaignViews: one call per campaign, null
// for a campaign whose brief is not sent yet. The staff side gets them whole; the customer gets the state until ready.
export const usePlans = (ids: Id[]) => q(["plans", ...ids], (a) => Promise.all(ids.map((id) => a.plan(id))), ids.length > 0);

// ── round 11 agencies ──
// FLOWS §24: the agency's Home, its clients, campaigns across clients, team and licence; Send to client and the link.
export const useAgencyHome = (enabled = true) => q(["agency", "home"], (a) => a.agencyHome(), enabled);
export const useAgencyClients = (enabled = true) => q(["agency", "clients"], (a) => a.agencyClients(), enabled);
export const useAgencyCampaigns = () => q(["agency", "campaigns"], (a) => a.agencyCampaigns());
export const useAgencyTeam = () => q(["agency", "team"], (a) => a.agencyTeam());
export const useLicence = () => q(["agency", "licence"], (a) => a.licence());
export const useAddClient = () => m((a, v: Parameters<FumeApi["addClient"]>[0]) => a.addClient(v));
export const useSendToClient = () => m((a, v: Parameters<FumeApi["sendToClient"]>[0]) => a.sendToClient(v));
export const useClientSends = (campaignId?: Id) => q(["agency", "sends", campaignId], (a) => a.clientSends(campaignId!), Boolean(campaignId));
export const useRecordClientApproval = () => m((a, v: Parameters<FumeApi["recordClientApproval"]>[0]) => a.recordClientApproval(v));
export const useClientLink = (token?: string) => q(["agency", "link", token], (a) => a.clientLink(token!), Boolean(token));
export const useAnswerClientLink = () => m((a, v: Parameters<FumeApi["answerClientLink"]>[0]) => a.answerClientLink(v));
export const useAnswerClientPlan = () => m((a, v: Parameters<FumeApi["answerClientPlan"]>[0]) => a.answerClientPlan(v));

// ── round 12 QA ──
export const useQaUncheck = () => m((a, itemId: Id) => a.qaUncheck(itemId));
export const useUndoDocumentToCheck = () => m((a, documentId: Id) => a.undoDocumentToCheck(documentId));

// ── round 13 campaign ──
// Marcus's video comments (22 Oct 2026): skip the moodboard, ask the expert to check the plan (optional), the brief's
// templates and Fume's alternatives.
export const useSkipMoodboard = () => m((a, campaignId: Id) => a.skipMoodboard(campaignId));
export const useAskPlanCheck = () => m((a, campaignId: Id) => a.askPlanCheck(campaignId));
export const useBriefTemplates = () => q(["brief-templates"], (a) => a.briefTemplates());
/** Asking for alternatives changes nothing, so nothing is refreshed. */
export const useBriefAlternatives = () => {
  const api = useApi();
  return useMutation({ mutationFn: (v: Parameters<FumeApi["briefAlternatives"]>[0]) => api.briefAlternatives(v) });
};

// ── round 13 brand ──
// Marcus's video comments (22 Oct 2026): a colour's uses, a picture's group, the voice's parts, "Neither" in a taste
// pair, and her own profile changed in place.
export const useSetColourUses = () => m((a, v: Parameters<FumeApi["setColourUses"]>[0]) => a.setColourUses(v));
export const useMoveImage = () => m((a, v: Parameters<FumeApi["moveImage"]>[0]) => a.moveImage(v));
export const useDecideVoicePart = () => m((a, v: Parameters<FumeApi["decideVoicePart"]>[0]) => a.decideVoicePart(v));
export const usePassTastePair = () => m((a, v: Parameters<FumeApi["passTastePair"]>[0]) => a.passTastePair(v));
export const useUpdateProfile = () => m((a, v: Parameters<FumeApi["updateProfile"]>[0]) => a.updateProfile(v));

// ── round 13 agency ──
// Marcus's video comments #70, #71 (22 Oct 2026): the agency's Fume plan, and asking Fume for people or help.
export const useAgencyPlan = (enabled = true) => q(["agency", "plan"], (a) => a.agencyPlan(), enabled);
export const useAskFume = () => m((a, v: Parameters<FumeApi["askFume"]>[0]) => a.askFume(v));

// Round 13 CHAT (#11, #20; PROPOSED 22 Oct 2026)
export const useMeetingTopics = () => q(["meetings", "topics"], (a) => a.meetingTopics());
export const useChangePlanWithFume = () => m((a, v: { campaignId: Id; text: string }) => a.changePlanWithFume(v.campaignId, v.text));
