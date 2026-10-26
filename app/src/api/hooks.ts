// Typed hooks over FumeApi, one per call. Query keys are the cache's names; mutations refresh what they change.
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { CampaignFilter, ChangeTag, CustomerRole, FumeApi, Id, Pin, QaPin } from "../contract";
import { useApi } from "./client";

const useQ = <T>(key: QueryKey, fn: (api: FumeApi) => Promise<T>, enabled = true) => {
  const api = useApi();
  return useQuery({ queryKey: key, queryFn: () => fn(api), enabled });
};

/** A mutation that refreshes everything once it lands: the mock is small, and the real backend sends events. */
const useM = <A, R>(fn: (api: FumeApi, args: A) => Promise<R>) => {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({ mutationFn: (args: A) => fn(api, args), onSuccess: () => client.invalidateQueries() });
};

// Session and home
export const useSession = () => useQ(["session"], (a) => a.session());
export const useHome = () => useQ(["home"], (a) => a.home());

// Brand DNA
export const useBrandDna = () => useQ(["brand"], (a) => a.brandDna());
export const useProduct = (id: Id) => useQ(["product", id], (a) => a.product(id));
export const useVerifyFact = () => useM((a, factId: Id) => a.verifyFact(factId));
export const useCorrectFact = () =>
  useM((a, v: { factId: Id; statement: string }) => a.correctFact(v.factId, v.statement));
export const useVerifyProduct = () => useM((a, id: Id) => a.verifyProduct(id));
export const useChooseTastePair = () =>
  useM((a, v: { pairId: Id; chosen: "a" | "b"; reason?: string }) => a.chooseTastePair(v.pairId, v.chosen, v.reason));
export const useAnswerUnderstanding = () =>
  useM((a, v: Parameters<FumeApi["answerUnderstanding"]>[0]) => a.answerUnderstanding(v));
export const useApproveBrandDna = () => useM((a, _: void) => a.approveBrandDna());
export const useUploadAssets = () =>
  useM((a, files: Parameters<FumeApi["uploadSourceAssets"]>[0]) => a.uploadSourceAssets(files));
export const useAddReference = () => useM((a, v: Parameters<FumeApi["addReference"]>[0]) => a.addReference(v));

// Campaigns
export const useCampaigns = (filter?: CampaignFilter) => useQ(["campaigns", filter], (a) => a.campaigns(filter));
export const useCampaign = (id: Id | undefined) => useQ(["campaign", id], (a) => a.campaign(id!), Boolean(id));
export const useCreative = (id: Id | undefined) => useQ(["creative", id], (a) => a.creative(id!), Boolean(id));
export const useStartCampaign = () => useM((a, v: { text: string }) => a.startCampaign(v));
export const useApproveBrief = () => useM((a, campaignId: Id) => a.approveBrief(campaignId));
export const useChooseDirection = () =>
  useM((a, v: { directionId: Id; reason?: string }) => a.chooseDirection(v.directionId, v.reason));
export const usePassDirections = () =>
  useM((a, v: { campaignId: Id; reason: string }) => a.passDirections(v.campaignId, v.reason));

// Review
export const useReviewQueue = () => useQ(["review"], (a) => a.reviewQueue());
export const useApprove = () => useM((a, versionIds: Id[]) => a.approve(versionIds));
export const useRequestChanges = () =>
  useM((a, v: { versionId: Id; pins: Pin[]; tags: ChangeTag[]; text: string }) => a.requestChanges(v));

// Deliveries
export const useDeliveries = () => useQ(["deliveries"], (a) => a.deliveries());
export const useDelivery = (id: Id | undefined) => useQ(["delivery", id], (a) => a.delivery(id!), Boolean(id));
export const useConfirmLive = () => useM((a, id: Id) => a.confirmLive(id));

// Fume
export const useThreads = () => useQ(["threads"], (a) => a.threads());
export const useMessages = (threadId: Id | undefined) =>
  useQ(["messages", threadId], (a) => a.messages(threadId!), Boolean(threadId));
export const useSend = () =>
  useM((a, v: { threadId: Id; text: string; attachments?: { name: string; bytes: number }[] }) =>
    a.send(v.threadId, v.text, v.attachments),
  );

// Team and settings
export const useTeam = () => useQ(["team"], (a) => a.team());
export const usePeople = () => useQ(["people"], (a) => a.people());
export const useInvite = () => useM((a, v: { email: string; role: CustomerRole }) => a.invite(v.email, v.role));
export const useChangeRole = () => useM((a, v: { userId: Id; role: CustomerRole }) => a.changeRole(v.userId, v.role));
export const useRemoveMember = () => useM((a, userId: Id) => a.removeMember(userId));
export const useSettings = () => useQ(["settings"], (a) => a.settings());
export const useUpdateWorkspace = () => useM((a, v: Parameters<FumeApi["updateWorkspace"]>[0]) => a.updateWorkspace(v));

// Notifications
export const useNotifications = () => useQ(["notifications"], (a) => a.notifications());
export const useMarkRead = () => useM((a, ids: Id[] | "all") => a.markRead(ids));

// Studio
export const useCheckQueue = () => useQ(["studio", "queue"], (a) => a.checkQueue());
export const useCheck = (id: Id | undefined) => useQ(["studio", "check", id], (a) => a.check(id!), Boolean(id));
export const usePassItem = () => useM((a, v: { checkId: Id; itemId: Id }) => a.passItem(v.checkId, v.itemId));
export const useAddNote = () =>
  useM((a, v: { checkId: Id; x: number; y: number; text: string; itemId?: Id }) => a.addNote(v.checkId, v));
export const useMarkChecked = () => useM((a, checkId: Id) => a.markChecked(checkId));
export const useRequestCorrection = () => useM((a, checkId: Id) => a.requestCorrection(checkId));
export const useHold = () => useM((a, v: { checkId: Id; reason: string }) => a.hold(v.checkId, v.reason));
export const useRelease = () => useM((a, campaignId: Id) => a.release(campaignId));
export const useStudioCampaigns = () => useQ(["studio", "campaigns"], (a) => a.studioCampaigns());
export const useQualityLog = () => useQ(["studio", "quality"], (a) => a.qualityLog());
export const useTeamLoad = () => useQ(["studio", "team"], (a) => a.teamLoad());

// Onboarding scan
export const useBrandScan = () => useQ(["scan"], (a) => a.brandScan());
export const useStartBrandScan = () => useM((a, v: Parameters<FumeApi["startBrandScan"]>[0]) => a.startBrandScan(v));
// Brand DNA board
export const useBrandBoard = () => useQ(["brand", "board"], (a) => a.brandBoard());
export const useDecide = () => useM((a, v: Parameters<FumeApi["decide"]>[0]) => a.decide(v));
// Catalogue
export const useCatalogue = () => useQ(["catalogue"], (a) => a.catalogue());
export const useCollection = (id: Id | undefined) => useQ(["collection", id], (a) => a.collection(id!), Boolean(id));
export const useAddCollection = () => useM((a, v: Parameters<FumeApi["addCollection"]>[0]) => a.addCollection(v));
export const useSetProductPlace = () =>
  useM((a, v: { productId: Id; categoryId?: Id; collectionIds?: Id[] }) => a.setProductPlace(v.productId, v));
// Boards
export const useBoards = () => useQ(["boards"], (a) => a.boards());
export const useBoard = (id: Id | undefined) => useQ(["board", id], (a) => a.board(id!), Boolean(id));
export const useAddBoardItem = () =>
  useM((a, v: { boardId: Id; item: Parameters<FumeApi["addBoardItem"]>[1] }) => a.addBoardItem(v.boardId, v.item));
export const useUpdateBoardItem = () =>
  useM((a, v: { boardId: Id; itemId: Id; change: Parameters<FumeApi["updateBoardItem"]>[2] }) =>
    a.updateBoardItem(v.boardId, v.itemId, v.change),
  );
export const useRemoveBoardItem = () =>
  useM((a, v: { boardId: Id; itemId: Id }) => a.removeBoardItem(v.boardId, v.itemId));
// Campaign scope and deliveries per collection
export const useSetCampaignScope = () =>
  useM((a, v: { campaignId: Id; productIds: Id[]; collectionIds: Id[] }) => a.setCampaignScope(v.campaignId, v));
export const useMakeDelivery = () => useM((a, v: { campaignId: Id; collectionId?: Id }) => a.makeDelivery(v));
// Fume's people: switcher levels and the Studio
export const useAllBrands = () => useQ(["studio", "all"], (a) => a.allBrands());
export const useBrandWorkspace = (id: Id | undefined) =>
  useQ(["studio", "brand", id], (a) => a.brandWorkspace(id!), Boolean(id));
export const useStudioKit = (workspaceId: Id | undefined) =>
  useQ(["studio", "kit", workspaceId], (a) => a.studioKit(workspaceId!), Boolean(workspaceId));
export const useStudioSession = (id: Id | undefined) =>
  useQ(["studio", "session", id], (a) => a.studioSession(id!), Boolean(id));
export const useOpenStudio = () => useM((a, v: Parameters<FumeApi["openStudio"]>[0]) => a.openStudio(v));
export const useGenerate = () =>
  useM((a, v: { sessionId: Id; recipe: Parameters<FumeApi["generate"]>[1] }) => a.generate(v.sessionId, v.recipe));
export const useRepair = () =>
  useM((a, v: { sessionId: Id; generationId: Id; what: string }) => a.repair(v.sessionId, v.generationId, v.what));
export const usePickGeneration = () =>
  useM((a, v: { sessionId: Id; generationId: Id }) => a.pickGeneration(v.sessionId, v.generationId));
export const useSendToCheck = () => useM((a, sessionId: Id) => a.sendToCheck(sessionId));

// Studio documents
export const useStudioModes = () => useQ(["studio", "modes"], (a) => a.studioModes());
export const useDocuments = (workspaceId: Id | undefined) =>
  useQ(["studio", "documents", workspaceId], (a) => a.documents(workspaceId!), Boolean(workspaceId));
export const useDocument = (id: Id | undefined) =>
  useQ(["studio", "document", id], (a) => a.document(id!), Boolean(id));
export const useOpenDocument = () => useM((a, v: Parameters<FumeApi["openDocument"]>[0]) => a.openDocument(v));
export const useUpdateDocument = () =>
  useM((a, v: { documentId: Id; change: Parameters<FumeApi["updateDocument"]>[1] }) =>
    a.updateDocument(v.documentId, v.change),
  );
export const useEngineEdit = () => useM((a, v: { documentId: Id; text: string }) => a.engineEdit(v.documentId, v.text));
export const useDecideEdit = () =>
  useM((a, v: { documentId: Id; editId: Id; verdict: "keep" | "undo" }) =>
    a.decideEdit(v.documentId, v.editId, v.verdict),
  );
export const useRender = () => useM((a, documentId: Id) => a.render(documentId));
export const usePickVersion = () =>
  useM((a, v: { documentId: Id; versionId: Id }) => a.pickVersion(v.documentId, v.versionId));
export const useAddVersion = () =>
  useM((a, v: { documentId: Id; file: File; note: string }) => a.addVersion(v.documentId, v.file, v.note));
export const useOverrideProduct = () =>
  useM((a, v: { documentId: Id; field: string; value: string; scope: "this_render" | "product" }) =>
    a.overrideProduct(v.documentId, v),
  );
export const useDocumentToCheck = () => useM((a, documentId: Id) => a.documentToCheck(documentId));
// Brand assets
export const useBrandAssets = (workspaceId?: Id) =>
  useQ(["assets", workspaceId ?? "mine"], (a) => a.brandAssets(workspaceId));
export const useSaveModel = () => useM((a, v: Parameters<FumeApi["saveModel"]>[0]) => a.saveModel(v));
export const useDecideModel = () =>
  useM((a, v: { modelId: Id; verdict: "approve" | "decline" }) => a.decideModel(v.modelId, v.verdict));
export const useSaveReference = () => useM((a, v: Parameters<FumeApi["saveReference"]>[0]) => a.saveReference(v));
export const useDecideOverride = () =>
  useM((a, v: { overrideId: Id; verdict: "approve" | "decline" }) => a.decideOverride(v.overrideId, v.verdict));
export const useProductProposals = (productId: Id | undefined) =>
  useQ(["product", productId, "proposals"], (a) => a.productProposals(productId!), Boolean(productId));
// QA
export const useQaQueue = (workspaceId?: Id) =>
  useQ(["studio", "qa", workspaceId ?? "all"], (a) => a.qaQueue(workspaceId));
export const useQaCheck = () => useM((a, itemId: Id) => a.qaCheck(itemId));
export const useQaFeedback = () =>
  useM((a, v: { itemId: Id; text: string; pins?: QaPin[] }) => a.qaFeedback(v.itemId, v.text, v.pins));
export const useQaEdit = () =>
  useM((a, v: { itemId: Id; layers: Parameters<FumeApi["qaEdit"]>[1] }) => a.qaEdit(v.itemId, v.layers));
export const useQaToStudio = () => useM((a, itemId: Id) => a.qaToStudio(itemId));
/** The designer takes the creative from the Engine; its fix stops. */
export const useQaTakeOver = () => useM((a, itemId: Id) => a.qaToStudio(itemId, true));
// Review like frame.io
export const useReviewComments = (creativeId: Id | undefined) =>
  useQ(["review", "comments", creativeId], (a) => a.reviewComments(creativeId!), Boolean(creativeId));
export const useAddReviewComment = () =>
  useM((a, v: Parameters<FumeApi["addReviewComment"]>[0]) => a.addReviewComment(v));
export const useResolveReviewComment = () => useM((a, commentId: Id) => a.resolveReviewComment(commentId));
export const useRate = () => useM((a, v: Parameters<FumeApi["rate"]>[0]) => a.rate(v));
export const useRatings = (campaignId: Id | undefined) =>
  useQ(["review", "ratings", campaignId], (a) => a.ratings(campaignId!), Boolean(campaignId));
// Taste
export const useTasteTraining = () => useQ(["taste"], (a) => a.tasteTraining());
export const useAnswerTaste = () => useM((a, v: Parameters<FumeApi["answerTaste"]>[0]) => a.answerTaste(v));
// One Fume chat and a brief without chat
export const useConversation = () => useQ(["conversation"], (a) => a.conversation());
export const useSay = () =>
  useM((a, v: { text: string; attachments?: { name: string; bytes: number }[] }) => a.say(v.text, v.attachments));
export const useOrderBrief = () => useM((a, order: Parameters<FumeApi["orderBrief"]>[0]) => a.orderBrief(order));
// Batches
export const useBatches = (campaignId?: Id) =>
  useQ(["studio", "batches", campaignId ?? "all"], (a) => a.batches(campaignId));
export const useStartBatch = () => useM((a, v: Parameters<FumeApi["startBatch"]>[0]) => a.startBatch(v));

// Placements and Make formats
export const usePlacements = () => useQ(["placements"], (a) => a.placements());
export const useMakeFormats = () =>
  useM((a, v: { documentId: Id; placementIds: Id[] }) => a.makeFormats(v.documentId, v.placementIds));
export const useSetFormatTile = () =>
  useM((a, v: { documentId: Id; placementId: Id; change: Parameters<FumeApi["setFormatTile"]>[2] }) =>
    a.setFormatTile(v.documentId, v.placementId, v.change),
  );
// Product fix
export const useDetailTokens = (productId: Id | undefined) =>
  useQ(["details", productId], (a) => a.detailTokens(productId!), Boolean(productId));
export const useFixProduct = () =>
  useM((a, v: { documentId: Id } & Parameters<FumeApi["fixProduct"]>[1]) => a.fixProduct(v.documentId, v));
// Light and camera
export const useLookPresets = (workspaceId: Id | undefined) =>
  useQ(["looks", workspaceId], (a) => a.lookPresets(workspaceId!), Boolean(workspaceId));
export const useSetSource = () =>
  useM((a, v: { documentId: Id; section: string; source: Parameters<FumeApi["setSource"]>[2] }) =>
    a.setSource(v.documentId, v.section, v.source),
  );
// The Engine chat
export const useEngineChat = (workspaceId: Id | undefined) =>
  useQ(["engine", "chat", workspaceId], (a) => a.engineChat(workspaceId!), Boolean(workspaceId));
export const useEngineSay = () => useM((a, v: { workspaceId: Id; text: string }) => a.engineSay(v.workspaceId, v.text));
export const useAnswerEngineWidget = () =>
  useM((a, v: { workspaceId: Id; messageId: Id; picked?: Id[]; choice?: string }) =>
    a.answerEngineWidget(v.workspaceId, v.messageId, v),
  );
// Admin
export const useUsage = () => useQ(["usage"], (a) => a.usage());
// Meetings and the calendar
export const useMeetingSlots = () => useQ(["meetings", "slots"], (a) => a.meetingSlots());
export const useBookMeeting = () => useM((a, v: { at: string; topic: string }) => a.bookMeeting(v));
export const useMeetings = () => useQ(["meetings"], (a) => a.meetings());
export const useCalendar = (from: string, to: string) => useQ(["calendar", from, to], (a) => a.calendar({ from, to }));
export const useSchedule = () => useM((a, v: Parameters<FumeApi["schedule"]>[0]) => a.schedule(v));
export const useMoveEntry = () => useM((a, v: { entryId: Id; at: string }) => a.moveEntry(v.entryId, v.at));
export const useRemoveEntry = () => useM((a, entryId: Id) => a.removeEntry(entryId));

// A campaign moodboard started on the spot
export const useStartMoodboard = () =>
  useM((a, v: { campaignId: Id; images: string[] }) => a.startMoodboard(v.campaignId, v.images));

// Product kinds and specs: a product category is a schema, like a Studio mode
export const useProductKinds = () => useQ(["productKinds"], (a) => a.productKinds());
export const useReadProduct = () => useM((a, v: Parameters<FumeApi["readProduct"]>[0]) => a.readProduct(v));
export const useSaveProductSpecs = () =>
  useM((a, v: { productId: Id } & Parameters<FumeApi["saveProductSpecs"]>[1]) => a.saveProductSpecs(v.productId, v));
export const useUploadShot = () =>
  useM((a, v: { productId: Id; slotId: Id; name: string; bytes: number; src?: string }) =>
    a.uploadShot(v.productId, v.slotId, { name: v.name, bytes: v.bytes, src: v.src }),
  );
export const useUploadProductFile = () =>
  useM((a, v: { productId: Id } & Parameters<FumeApi["uploadProductFile"]>[1]) => a.uploadProductFile(v.productId, v));

// The brief, line by line: a manual brief is finished where it is read.
export const useChangeBrief = () =>
  useM((a, v: { campaignId: Id; change: Parameters<FumeApi["changeBrief"]>[1] }) =>
    a.changeBrief(v.campaignId, v.change),
  );

// Update the brand. The update is polled while the Engine reads.
export const useBrandUpdate = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["brandUpdate"],
    queryFn: () => api.brandUpdate(),
    refetchInterval: (query) => (query.state.data?.state === "reading" ? 700 : false),
  });
};
export const useStartBrandUpdate = () =>
  useM((a, v: Parameters<FumeApi["startBrandUpdate"]>[0]) => a.startBrandUpdate(v));
export const useDecideBrandFound = () =>
  useM((a, v: Parameters<FumeApi["decideBrandFound"]>[0]) => a.decideBrandFound(v));
export const useApproveBrandUpdate = () => useM((a, updateId: Id) => a.approveBrandUpdate(updateId));

// Import products: the import under way polls until it has something to show.
export const useProductImport = () => {
  const api = useApi();
  return useQuery({
    queryKey: ["productImport"],
    queryFn: () => api.productImport(),
    refetchInterval: (query) => (query.state.data?.state === "reading" ? 600 : false),
  });
};
export const useStartProductImport = () =>
  useM((a, v: Parameters<FumeApi["startProductImport"]>[0]) => a.startProductImport(v));
export const useMapImportColumns = () =>
  useM((a, v: { jobId: Id; columns: Parameters<FumeApi["mapImportColumns"]>[1] }) =>
    a.mapImportColumns(v.jobId, v.columns),
  );
export const useDecideFound = () =>
  useM((a, v: { jobId: Id; foundId: Id; decision: Parameters<FumeApi["decideFound"]>[2] }) =>
    a.decideFound(v.jobId, v.foundId, v.decision),
  );
export const useApproveImport = () => useM((a, jobId: Id) => a.approveImport(jobId));
export const useDismissImport = () => useM((a, jobId: Id) => a.dismissImport(jobId));

// One question, one sheet (features/questions/QuestionSheet.tsx): the open questions, and the one way to answer them.
export const useQuestions = () => useQ(["questions"], (a) => a.questions());
export const useAnswerQuestion = () => useM((a, v: Parameters<FumeApi["answerQuestion"]>[0]) => a.answerQuestion(v));

// Approve with Undo, and one change request for a review set (features/review).
export const useUnapprove = () => useM((a, versionIds: Id[]) => a.unapprove(versionIds));
export const useRequestChangeRound = () =>
  useM((a, v: Parameters<FumeApi["requestChangeRound"]>[0]) => a.requestChangeRound(v));

export const useOnboardingProgress = () => useQ(["onboarding"], (a) => a.onboardingProgress());
export const useSaveOnboardingProgress = () =>
  useM((a, v: Parameters<FumeApi["saveOnboardingProgress"]>[0]) => a.saveOnboardingProgress(v));

// Undo for a change request just sent, and several campaigns at once so a collection's approved work gets the same
// short names ("Feed A2") as on each campaign (features/review/names.ts).
export const useWithdrawChangeRound = () =>
  useM((a, v: Parameters<FumeApi["withdrawChangeRound"]>[0]) => a.withdrawChangeRound(v));
export const useCampaignViews = (ids: Id[]) =>
  useQ(["campaign-views", ...ids], (a) => Promise.all(ids.map((id) => a.campaign(id))), ids.length > 0);

// A brief half made in the Fume chat: Home shows it as a Waiting row, "Christmas · Hand Balm · Fume asked who it should
// reach", which opens the chat at that question. One per campaign started in the chat whose newest word is Fume's open
// question (a brief that is complete waits on Home as the brief to approve instead). Composed from the conversation the
// chat already reads, so the row and the chat never disagree.
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
  const m =
    /^(who|what|when|where|how|which \S+)\s+(should|is|are|will|does|do|can|may)\s+(it|we|you|they)\s+(.+)$/i.exec(q);
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
    const named =
      [...said]
        .reverse()
        .map((m) =>
          m.card?.kind === "question" ? (m.card as import("../contract").ProductQuestionCard).named : undefined,
        )
        .find((n) => n?.length) ?? [];
    const names = products.filter((p) => campaign.productIds.includes(p.id)).map((p) => p.name);
    const productName =
      (names.length ? names : products.filter((p) => named.includes(p.id)).map((p) => p.name)).join(" and ") ||
      undefined;
    const title =
      productName && !campaign.name.toLowerCase().includes(productName.toLowerCase())
        ? `${campaign.name} · ${productName}`
        : campaign.name;
    const asked = `Fume asked ${askedAs(card.question)}`;
    drafts.push({
      campaignId: campaign.id,
      threadId: t.id,
      campaignName: campaign.name,
      productName,
      title,
      question: card.question,
      asked,
      line: `${title} · ${asked}`,
      href: `/fume/${t.id}`,
      at: newest.at,
    });
  }
  return { data: drafts.sort((a, b) => b.at.localeCompare(a.at)), isPending: false };
}

// The plan Fume writes from the brief she sent; she approves it before the Engine makes anything (FLOWS §22).
export const usePlan = (campaignId: Id | undefined) =>
  useQ(["plan", campaignId], (a) => a.plan(campaignId!), Boolean(campaignId));
export const useSendBrief = () => useM((a, campaignId: Id) => a.sendBrief(campaignId));
export const useApprovePlan = () => useM((a, campaignId: Id) => a.approvePlan(campaignId));
export const useUndoApprovePlan = () => useM((a, campaignId: Id) => a.undoApprovePlan(campaignId));
export const useChangePlan = () =>
  useM((a, v: { campaignId: Id } & import("../contract").PlanChange) => {
    const { campaignId, ...change } = v;
    return a.changePlan(campaignId, change);
  });
export const useChoosePlanDirection = () =>
  useM((a, v: { campaignId: Id; directionId: Id; reason?: string }) =>
    a.choosePlanDirection(v.campaignId, v.directionId, v.reason),
  );
export const useAskPlanChanges = () =>
  useM((a, v: { campaignId: Id; note: string }) => a.askPlanChanges(v.campaignId, v.note));
export const useCheckPlan = () => useM((a, campaignId: Id) => a.checkPlan(campaignId));

// The plans of several campaigns at once (⌘K, Home's plan rows), like useCampaignViews: one call per campaign, null for
// a campaign whose brief is not sent yet. The staff side gets them whole; the customer gets the state until ready.
export const usePlans = (ids: Id[]) =>
  useQ(["plans", ...ids], (a) => Promise.all(ids.map((id) => a.plan(id))), ids.length > 0);

// The agency (FLOWS §24): its Home, its clients, campaigns across clients, team and licence; Send to client and the
// client link.
export const useAgencyHome = (enabled = true) => useQ(["agency", "home"], (a) => a.agencyHome(), enabled);
export const useAgencyClients = (enabled = true) => useQ(["agency", "clients"], (a) => a.agencyClients(), enabled);
export const useAgencyCampaigns = () => useQ(["agency", "campaigns"], (a) => a.agencyCampaigns());
export const useAgencyTeam = () => useQ(["agency", "team"], (a) => a.agencyTeam());
export const useLicence = () => useQ(["agency", "licence"], (a) => a.licence());
export const useAddClient = () => useM((a, v: Parameters<FumeApi["addClient"]>[0]) => a.addClient(v));
export const useSendToClient = () => useM((a, v: Parameters<FumeApi["sendToClient"]>[0]) => a.sendToClient(v));
export const useClientSends = (campaignId?: Id) =>
  useQ(["agency", "sends", campaignId], (a) => a.clientSends(campaignId!), Boolean(campaignId));
export const useRecordClientApproval = () =>
  useM((a, v: Parameters<FumeApi["recordClientApproval"]>[0]) => a.recordClientApproval(v));
export const useClientLink = (token?: string) =>
  useQ(["agency", "link", token], (a) => a.clientLink(token!), Boolean(token));
export const useAnswerClientLink = () =>
  useM((a, v: Parameters<FumeApi["answerClientLink"]>[0]) => a.answerClientLink(v));
export const useAnswerClientPlan = () =>
  useM((a, v: Parameters<FumeApi["answerClientPlan"]>[0]) => a.answerClientPlan(v));

// Check
export const useQaUncheck = () => useM((a, itemId: Id) => a.qaUncheck(itemId));
export const useUndoDocumentToCheck = () => useM((a, documentId: Id) => a.undoDocumentToCheck(documentId));

// The campaign: skip the moodboard, ask the expert to check the plan (optional), the brief's templates and Fume's
// alternatives.
export const useSkipMoodboard = () => useM((a, campaignId: Id) => a.skipMoodboard(campaignId));
export const useAskPlanCheck = () => useM((a, campaignId: Id) => a.askPlanCheck(campaignId));
export const useBriefTemplates = () => useQ(["brief-templates"], (a) => a.briefTemplates());
/** Asking for alternatives changes nothing, so nothing is refreshed. */
export const useBriefAlternatives = () => {
  const api = useApi();
  return useMutation({ mutationFn: (v: Parameters<FumeApi["briefAlternatives"]>[0]) => api.briefAlternatives(v) });
};

// Brand: a colour's uses, a picture's group, the voice's parts, "Neither" in a taste pair, and her own profile changed
// in place.
export const useSetColourUses = () => useM((a, v: Parameters<FumeApi["setColourUses"]>[0]) => a.setColourUses(v));
export const useMoveImage = () => useM((a, v: Parameters<FumeApi["moveImage"]>[0]) => a.moveImage(v));
export const useDecideVoicePart = () => useM((a, v: Parameters<FumeApi["decideVoicePart"]>[0]) => a.decideVoicePart(v));
export const usePassTastePair = () => useM((a, v: Parameters<FumeApi["passTastePair"]>[0]) => a.passTastePair(v));
export const useUpdateProfile = () => useM((a, v: Parameters<FumeApi["updateProfile"]>[0]) => a.updateProfile(v));

// The agency's Fume plan, and asking Fume for people or help.
export const useAgencyPlan = (enabled = true) => useQ(["agency", "plan"], (a) => a.agencyPlan(), enabled);
export const useAskFume = () => useM((a, v: Parameters<FumeApi["askFume"]>[0]) => a.askFume(v));

// Meeting topics
export const useMeetingTopics = () => useQ(["meetings", "topics"], (a) => a.meetingTopics());
export const useChangePlanWithFume = () =>
  useM((a, v: { campaignId: Id; text: string }) => a.changePlanWithFume(v.campaignId, v.text));
