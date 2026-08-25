const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const STORE = {
  settings: "clean_master.settings.v1",
  history: "clean_master.history.v1",
  cash: "clean_master.cash.v1",
  events: "clean_master.cash_events.v1",
  lastCare: "clean_master.last_care.v1",
  returns: "clean_master.return_count.v1",
  badges: "clean_master.badges.v1",
  decor: "clean_master.farm_decor.v1",
  gifts: "clean_master.gifts.v1",
  farmGrowth: "clean_master.farm_growth.v1",
  farmer: "clean_master.farmer.v1",
  outfits: "clean_master.farmer_outfits.v1",
  seeds: "clean_master.farm_seeds.v1",
  memorySeedMigration: "clean_master.memory_seed_migration.v1",
  photoPairs: "clean_master.photo_pair_hashes.v1",
  completedAreas: "clean_master.completed_areas.v1",
  weeklyPlan: "clean_master.weekly_plan.v1",
  gardenCrop: "clean_master.garden_crop.v1",
};
const AUTH = {
  accounts: "clean_master.local_accounts.v1",
  session: "clean_master.local_session.v1",
  legacyMigration: "clean_master.local_profile_migration.v1",
};
const LABELS = {
  area: { desk: "책상", sink: "싱크대", sofa: "소파", bed: "침대·침구", shoe_rack: "신발장", bathroom: "욕실", kitchen: "주방", other: "다른 공간" },
  careType: { organize: "정리할 것", clean: "청소할 것", laundry: "세탁할 것" },
  focus: { water_scale: "물때·광물 자국", soap_scum: "비누막", grease: "기름때", dust: "먼지·부스러기", clutter: "물건 정리", laundry: "세탁할 천·의류", unknown: "직접 확인 필요" },
};
const CARE_STEP_MEMORY = 3;
const MEMORY_PLANT_COST = 1;
const state = { step: 1, scenario: 0, guide: null, images: {}, planAreas: [], planPhoto: null, planAfterPhoto: null, planGuide: null };

const DECOR_ITEMS = [
  { id: "scarecrow", icon: "🌾", title: "밀짚 허수아비", body: "사람 캐릭터와 헷갈리지 않는 볏짚 표식이에요.", cost: 15 },
  { id: "fence", icon: "🪵", title: "통나무 울타리", body: "밭의 경계를 포근하게 둘러줘요.", cost: 20 },
  { id: "pond", icon: "🦆", title: "오리 연못", body: "농장 한쪽에 잔잔한 물가를 만들어요.", cost: 25 },
  { id: "flower-cart", icon: "🌼", title: "꽃 수레", body: "수확길에 알록달록한 계절을 더해요.", cost: 30 },
];
const GIFT_ITEMS = [
  { id: "convenience-coupon", icon: "🏪", title: "편의점 3,000원 쿠폰", body: "가까운 편의점에서 사용할 수 있는 쿠폰", cost: 300 },
  { id: "twosome-cake", icon: "🍰", title: "투썸 조각케이크", body: "달콤한 조각케이크를 위한 쿠폰", cost: 500 },
  { id: "olive-young-coupon", icon: '<img src="/assets/olive-young-logo.svg" alt="올리브영 로고">', title: "올리브영 10,000원 쿠폰", body: "올리브영에서 사용할 수 있는 쿠폰", cost: 1000 },
];
const OUTFIT_ITEMS = [
  { id: "pink-apron", icon: "🎀", title: "분홍 앞치마", body: "포근한 분홍색 앞치마와 리본으로 갈아입어요.", cost: 12 },
  { id: "blue-overalls", icon: "🧢", title: "파란 멜빵 작업복", body: "밭일에 잘 어울리는 산뜻한 파란 작업복이에요.", cost: 18 },
  { id: "rainbow-coat", icon: "🌈", title: "무지개 우비", body: "비 오는 날에도 반짝이는 특별한 농부 옷이에요.", cost: 25 },
];
const LEGACY_SEED_VALUES = { tomato: 2, carrot: 3, strawberry: 4, corn: 6 };
const CROP_TYPES = {
  tomato: { name: "햇살나무", stages: ["·", "🌱", "🌿", "🌳"], ripe: "햇살나무가 푸르게 자랐어요!", intervalMs: 300_000, intervalLabel: "5분", totalLabel: "약 15분" },
  carrot: { name: "응원나무", stages: ["·", "🌱", "🌿", "🌲"], ripe: "응원나무가 든든하게 자랐어요!", intervalMs: 600_000, intervalLabel: "10분", totalLabel: "약 30분" },
  strawberry: { name: "꽃나무", stages: ["·", "🌱", "🌿", "🌸"], ripe: "꽃나무에 다정한 꽃이 피었어요!", intervalMs: 1_200_000, intervalLabel: "20분", totalLabel: "약 1시간" },
  corn: { name: "열매나무", stages: ["·", "🌱", "🌿", "🍎"], ripe: "열매나무에 기억 열매가 맺혔어요!", intervalMs: 3_600_000, intervalLabel: "1시간", totalLabel: "약 3시간" },
};
let farmActionBusy = false;
const FARMER_AVATARS = { woman: "👩‍🌾", man: "👨‍🌾" };
const FARMER_OUTFITS = { classic: "", flower: "🌼", star: "⭐", "pink-apron": "🎀", "blue-overalls": "🧢", "rainbow-coat": "🌈" };
const FREE_FARMER_OUTFITS = ["classic", "flower", "star"];

function rawRead(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function rawWrite(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function profileId(nickname) { return encodeURIComponent(nickname.trim().toLocaleLowerCase("ko-KR")); }
function accounts() { return rawRead(AUTH.accounts, {}); }
function currentAccount() {
  const session = rawRead(AUTH.session, null);
  return session?.id && accounts()[session.id] ? accounts()[session.id] : null;
}
function profileStoreKey(key) {
  const account = currentAccount();
  return account ? `${key}.profile.${account.id}` : key;
}
function read(key, fallback) { return rawRead(profileStoreKey(key), fallback); }
function write(key, value) { rawWrite(profileStoreKey(key), value); }
async function passwordHash(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function migrateLegacyProfile(account) {
  if (rawRead(AUTH.legacyMigration, null)) return;
  Object.values(STORE).forEach((key) => {
    const legacyValue = localStorage.getItem(key);
    const profileKey = `${key}.profile.${account.id}`;
    if (legacyValue !== null && localStorage.getItem(profileKey) === null) localStorage.setItem(profileKey, legacyValue);
  });
  rawWrite(AUTH.legacyMigration, { accountId: account.id, migratedAt: new Date().toISOString() });
}
function renderAccount() {
  const account = currentAccount();
  const name = account?.nickname || "로그인";
  $("#accountNickname").textContent = name;
  $("#accountButton").setAttribute("aria-label", `${name} 계정 설정 열기`);
}
function openLogin() {
  const account = currentAccount();
  const dialog = $("#loginDialog");
  $("#loginNickname").value = account?.nickname || "";
  $("#loginPassword").value = "";
  $("#loginError").textContent = "";
  if (!dialog.open) dialog.showModal();
}
function startSignedInApp() {
  migrateSeedInventoryToMemory();
  const settings = read(STORE.settings, {});
  document.body.classList.toggle("easy", !!settings.easy);
  updateZoomButton(!!settings.easy);
  renderAccount();
  const requested = ["home", "mission", "room", "community", "cash"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
  showView(read(STORE.weeklyPlan, null) ? requested : "mission");
  updateCounters(); renderDailyMission(); renderSpendShop(); renderRoom(); health();
}
async function submitLogin(event) {
  event.preventDefault();
  const nickname = $("#loginNickname").value.trim();
  const password = $("#loginPassword").value;
  const error = $("#loginError");
  if ([...nickname].length < 2 || [...nickname].length > 12) { error.textContent = "닉네임은 2~12자로 입력해주세요."; return; }
  if ([...password].length !== 4) { error.textContent = "비밀번호는 정확히 4자로 입력해주세요."; return; }
  if (!globalThis.crypto?.subtle) { error.textContent = "이 브라우저에서는 로그인 저장을 지원하지 않아요."; return; }
  const id = profileId(nickname);
  const savedAccounts = accounts();
  const digest = await passwordHash(password);
  const saved = savedAccounts[id];
  if (saved && saved.passwordHash !== digest) { error.textContent = "비밀번호가 맞지 않아요."; return; }
  const account = saved || { id, nickname, passwordHash: digest, createdAt: new Date().toISOString() };
  if (!saved) rawWrite(AUTH.accounts, { ...savedAccounts, [id]: account });
  rawWrite(AUTH.session, { id: account.id });
  migrateLegacyProfile(account);
  $("#loginDialog").close();
  startSignedInApp();
  toast(`${account.nickname}님, 돌봄 농장에 다시 왔어요. 💚`);
}
function today() { return new Date().toLocaleDateString("en-CA"); }
function escapeHtml(value) { const d = document.createElement("div"); d.textContent = String(value ?? ""); return d.innerHTML; }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600); }
function loading(on, text = "사진을 살펴보고 있어요") { $("#loadingText").textContent = text; $("#loading").classList.toggle("hidden", !on); }
function updateZoomButton(active) { const button = $("#easyToggle"); button.textContent = active ? "축소 모드" : "확대 모드"; button.setAttribute("aria-pressed", active); button.setAttribute("aria-label", active ? "화면 축소 모드" : "화면 확대 모드"); }

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data = {};
  try { data = await response.json(); } catch { /* empty */ }
  if (!response.ok) throw new Error(data.error || data.detail || "요청을 처리하지 못했어요.");
  return data;
}

function showView(id) {
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === id));
  $$(".bottom-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === id));
  if (id === "room") renderRoom();
  if (id === "cash") renderCash();
  if (id === "community") renderCommunity();
  if (id === "mission") renderWeeklyPlan();
  location.hash = id;
  scrollTo({ top: 0, behavior: "smooth" });
}

async function renderCommunity() {
  const container = $("#communityPosts");
  if (!container) return;
  container.innerHTML = '<p class="empty">이야기를 불러오는 중이에요.</p>';
  try {
    const response = await fetch("/api/community/posts");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했어요.");
    const posts = Array.isArray(data.posts) ? data.posts : [];
    container.innerHTML = posts.length ? posts.map((post, index) => `<article class="community-post" data-open-post="${escapeHtml(post.id)}" tabindex="0" role="button" aria-label="${escapeHtml(post.title)} 글 열기"><span class="community-post-number">${posts.length - index}</span><div class="community-post-title"><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.body).replace(/\n/g, " ")}</p></div><span class="community-post-author">익명</span><small class="community-post-date">${escapeHtml(post.created_at || "오늘")}</small>${post.can_delete ? `<details class="community-delete"><summary>내 글 삭제</summary><div><label>삭제용 비밀번호<input type="password" maxlength="64" autocomplete="current-password" data-delete-password="${escapeHtml(post.id)}" placeholder="작성할 때 정한 비밀번호"></label><button class="text-button danger" data-delete-post="${escapeHtml(post.id)}">이 글 삭제</button></div></details>` : ""}</article>`).join("") : '<p class="empty">첫 번째 게시글을 남겨볼까요?</p>';
    $$('[data-delete-post]', container).forEach((button) => button.addEventListener("click", () => deleteCommunityPost(button.dataset.deletePost)));
    container.onclick = (event) => {
      if (event.target.closest(".community-delete")) return;
      const card = event.target.closest("[data-open-post]");
      if (card) openCommunityThread(card.dataset.openPost);
    };
    container.onkeydown = (event) => {
      if (event.target.closest(".community-delete")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-open-post]");
      if (!card) return;
      event.preventDefault();
      openCommunityThread(card.dataset.openPost);
    };
  } catch (error) { container.innerHTML = `<p class="empty">${escapeHtml(error.message || "게시글을 불러오지 못했어요.")}</p>`; }
}

function renderCommunityComments(comments) {
  const container = $("#communityCommentList");
  container.innerHTML = comments.length
    ? comments.map((comment) => `<article class="community-comment"><p>${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p><small>익명 · ${escapeHtml(comment.created_at || "오늘")}</small></article>`).join("")
    : '<p class="community-comment-empty">아직 댓글이 없어요. 첫 번째 익명 댓글을 남겨볼까요?</p>';
}

async function openCommunityThread(postId) {
  const dialog = $("#communityDialog");
  try {
    const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했어요.");
    const post = data.post || {};
    $("#communityDialogTitle").textContent = post.title || "익명 이야기";
    $("#communityDialogBody").textContent = post.body || "";
    $("#communityDialogMeta").textContent = `익명 · ${post.created_at || "오늘"}`;
    $("#communityCommentPostId").value = post.id || postId;
    $("#communityCommentBody").value = "";
    renderCommunityComments(Array.isArray(data.comments) ? data.comments : []);
    if (!dialog.open) dialog.showModal();
  } catch (error) { toast(error.message || "게시글을 열지 못했어요."); }
}

async function submitCommunityComment(event) {
  event.preventDefault();
  const postId = $("#communityCommentPostId").value;
  const body = $("#communityCommentBody").value;
  const button = $("#communityCommentForm button[type=submit]");
  if (body.trim().length < 2) { toast("댓글을 2자 이상 입력해주세요."); $("#communityCommentBody").focus(); return; }
  button.disabled = true;
  try {
    await post(`/api/community/posts/${encodeURIComponent(postId)}/comments`, { body });
    toast("익명 댓글을 등록했어요.");
    await openCommunityThread(postId);
  } catch (error) { toast(error.message || "댓글을 등록하지 못했어요."); }
  finally { button.disabled = false; }
}

async function submitCommunityPost(event) {
  event.preventDefault();
  const button = $("#communityForm button[type=submit]");
  const payload = { title: $("#communityTitle").value, body: $("#communityBody").value, delete_password: $("#communityPassword").value };
  if (payload.title.trim().length < 2) { toast("제목을 2자 이상 입력해주세요."); $("#communityTitle").focus(); return; }
  if (payload.body.trim().length < 5) { toast("내용을 5자 이상 입력해주세요."); $("#communityBody").focus(); return; }
  if (payload.delete_password.length < 4) { toast("글을 삭제할 때 쓸 비밀번호를 4자 이상 입력해주세요."); $("#communityPassword").focus(); return; }
  button.disabled = true;
  try { await post("/api/community/posts", payload); event.currentTarget.reset(); toast("익명 이야기를 공유했어요."); renderCommunity(); }
  catch (error) { toast(error.message || "게시글을 올리지 못했어요."); }
  finally { button.disabled = false; }
}

async function deleteCommunityPost(postId) {
  const password = $(`[data-delete-password="${postId}"]`)?.value || "";
  if (!password) { toast("삭제용 비밀번호를 입력해주세요."); return; }
  try {
    const response = await fetch(`/api/community/posts/${encodeURIComponent(postId)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delete_password: password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "게시글을 삭제하지 못했어요.");
    toast("게시글을 삭제했어요.");
    renderCommunity();
  } catch (error) { toast(error.message || "게시글을 삭제하지 못했어요."); }
}

function goStep(step) {
  state.step = step;
  $$(".mission-step").forEach((el) => el.classList.toggle("active", Number(el.dataset.step) === step));
  $$(".progress i").forEach((el, i) => el.classList.toggle("on", i < step));
  const names = ["사진 관찰", "오염 확인", "청소 실행"];
  $("#progressText").textContent = `${step} / 3 ${names[step - 1]}`;
  scrollTo({ top: 70, behavior: "smooth" });
}

function completedAreas() { return read(STORE.completedAreas, []); }
function renderAvailableAreas() {
  const select = $("#careArea");
  if (!select) return;
  const completed = new Set(completedAreas());
  [...select.options].forEach((option) => {
    const done = completed.has(option.value);
    option.disabled = done;
    option.textContent = `${LABELS.area[option.value]}${done ? " · 완료" : ""}`;
  });
  if (completed.has(select.value)) select.value = [...select.options].find((option) => !option.disabled)?.value || "";
  const available = [...select.options].some((option) => !option.disabled);
  $("#careAreaNote").textContent = available
    ? "전후 사진으로 완료된 장소는 이번 기록에서 다시 선택할 수 없어요."
    : "모든 장소를 완료했어요. 기록을 남긴 멋진 하루예요!";
  $("#analyzeArea").disabled = !available;
  renderCareSummary();
}

function resetMissionForNewArea() {
  state.step = 1;
  state.scenario = 0;
  state.guide = null;
  state.images = {};
  ["areaImage", "afterImage"].forEach((id) => { $(`#${id}`).value = ""; });
  ["areaPreview", "afterPreview"].forEach((id) => { const preview = $(`#${id}`); preview.removeAttribute("src"); preview.parentElement.classList.remove("has-image"); });
  ["compareBeforePreview", "compareAfterPreview"].forEach((id) => $("#" + id).removeAttribute("src"));
  $("#removeArea").classList.add("hidden");
  $("#areaConfirmed").checked = false;
  $("#completion").classList.remove("hidden");
  $("#comparisonChecklist").classList.add("hidden");
  $("#comparisonChecklist").innerHTML = "";
  $("#compareResult").innerHTML = "";
  $("#startNewMission").classList.add("hidden");
  renderAvailableAreas();
  goStep(1);
  showView("mission");
}

function cashEvents() { return read(STORE.events, []); }
function dayGap(from, to) { return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000); }
function addRewardEvent(key, amount, title) {
  const events = cashEvents();
  if (events.some((e) => e.key === key)) return false;
  events.unshift({ key, amount, title, at: new Date().toISOString() });
  write(STORE.events, events.slice(0, 100));
  write(STORE.cash, Number(read(STORE.cash, 0)) + amount);
  return true;
}
function reward(id, amount, title) {
  const key = `${today()}:${id}`;
  if (cashEvents().some((e) => e.key === key)) return false;
  const lastCare = read(STORE.lastCare, null);
  if (lastCare && dayGap(lastCare, today()) >= 2 && addRewardEvent(`${today()}:welcome-back`, 5, "다시 시작한 날 보너스")) {
    write(STORE.returns, Number(read(STORE.returns, 0)) + 1);
  }
  addRewardEvent(key, amount, title);
  write(STORE.lastCare, today());
  updateCounters();
  toast(`${title} · 기억의 조각 +${amount}개`);
  return true;
}

function updateCounters() {
  const cash = Number(read(STORE.cash, 0));
  $$('[data-cash]').forEach((el) => el.textContent = cash);
  $$('[data-returns]').forEach((el) => el.textContent = Number(read(STORE.returns, 0)));
  $$('[data-badges]').forEach((el) => el.textContent = Number(read(STORE.badges, 0)));
}

function ownedDecor() { return read(STORE.decor, []); }
function hasDecor(id) { return ownedDecor().includes(id); }
function ownedFarmerOutfits() { return [...new Set([...FREE_FARMER_OUTFITS, ...read(STORE.outfits, [])])]; }
function migrateSeedInventoryToMemory() {
  if (read(STORE.memorySeedMigration, false)) return;
  const saved = read(STORE.seeds, {});
  const restored = Object.entries(LEGACY_SEED_VALUES).reduce((sum, [id, value]) => sum + Math.max(0, Number(saved[id]) || 0) * value, 0);
  if (restored > 0) {
    const events = cashEvents();
    events.unshift({ key: "memory-seed-migration", amount: restored, title: "기존 씨앗을 기억의 조각으로 전환", at: new Date().toISOString() });
    write(STORE.events, events.slice(0, 100));
    write(STORE.cash, Number(read(STORE.cash, 0)) + restored);
  }
  write(STORE.seeds, {});
  write(STORE.memorySeedMigration, true);
}
function spendMemories(id, amount, title, kind) {
  const balance = Number(read(STORE.cash, 0));
  if (balance < amount) { toast(`기억의 조각이 ${amount - balance}개 부족해요.`); return false; }
  const events = cashEvents();
  const key = `${today()}:spend-${kind}-${id}`;
  if (events.some((event) => event.key === key)) return false;
  events.unshift({ key, amount: -amount, title, kind, itemId: id, at: new Date().toISOString() });
  write(STORE.events, events.slice(0, 100));
  write(STORE.cash, balance - amount);
  updateCounters();
  toast(`${title} · 기억의 조각 -${amount}개`);
  return true;
}

function purchaseDecor(item) {
  if (hasDecor(item.id)) return;
  if (!spendMemories(item.id, item.cost, `${item.title} 꾸미기`, "decor")) return;
  write(STORE.decor, [...ownedDecor(), item.id]);
  renderSpendShop();
  renderRoom();
}

function selectGift(item) {
  const selected = read(STORE.gifts, []);
  if (selected.some((gift) => gift.id === item.id)) return;
  if (!spendMemories(item.id, item.cost, `${item.title} 선택`, "gift")) return;
  selected.unshift({ ...item, selectedAt: new Date().toISOString() });
  write(STORE.gifts, selected.slice(0, 20));
  renderSpendShop();
}

function purchaseFarmerOutfit(item) {
  if (!item || ownedFarmerOutfits().includes(item.id)) return;
  if (!spendMemories(item.id, item.cost, `${item.title} 선물`, "outfit")) return;
  write(STORE.outfits, [...read(STORE.outfits, []), item.id]);
  write(STORE.farmer, { ...farmerStyle(), outfit: item.id });
  renderFarmerStyle();
  renderSpendShop();
  toast(`${item.title}을 입혀줬어요!`);
}

function farmGrowth() {
  const saved = read(STORE.farmGrowth, {});
  const normalize = (value = {}) => {
    const stage = Math.max(0, Math.min(3, Number(value.stage) || 0));
    return {
      stage,
      harvests: Math.max(0, Number(value.harvests) || 0),
      planted: typeof value.planted === "boolean" ? value.planted : stage > 0,
      readyAt: Math.max(0, Number(value.readyAt) || 0),
      quality: value.quality === "rainbow" ? "rainbow" : "standard",
      cycleId: Number(value.cycleId) || 0,
    };
  };
  const legacyTomato = saved.plots ? saved.plots.tomato : { stage: saved.stage, harvests: saved.harvests };
  return {
    active: CROP_TYPES[saved.active] ? saved.active : "tomato",
    plots: {
      tomato: normalize(legacyTomato),
      carrot: normalize(saved.plots?.carrot),
      strawberry: normalize(saved.plots?.strawberry),
      corn: normalize(saved.plots?.corn),
    },
  };
}

function formatCropTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}분 ${String(seconds).padStart(2, "0")}초` : `${seconds}초`;
}

function farmerStyle() {
  const saved = read(STORE.farmer, {});
  return {
    avatar: FARMER_AVATARS[saved.avatar] ? saved.avatar : "woman",
    outfit: Object.hasOwn(FARMER_OUTFITS, saved.outfit) ? saved.outfit : "classic",
  };
}

function renderFarmerStyle() {
  if (!$(".worker-character")) return;
  const style = farmerStyle();
  const owned = ownedFarmerOutfits();
  $(".worker-character").textContent = FARMER_AVATARS[style.avatar];
  $(".worker-accessory").textContent = FARMER_OUTFITS[style.outfit];
  $(".farm-worker").dataset.outfit = style.outfit;
  $$('[data-farmer-avatar]').forEach((button) => {
    const active = button.dataset.farmerAvatar === style.avatar;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $$('[data-farmer-outfit]').forEach((button) => {
    const active = button.dataset.farmerOutfit === style.outfit;
    const available = owned.includes(button.dataset.farmerOutfit);
    button.classList.toggle("active", active);
    button.classList.toggle("locked", !available);
    button.disabled = !available;
    button.textContent = `${available ? "" : "🔒 "}${button.dataset.outfitLabel || button.textContent.replace(/^🔒\s*/, "")}`;
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateFarmerStyle(key, value) {
  const style = farmerStyle();
  if (key === "outfit" && !ownedFarmerOutfits().includes(value)) {
    toast("기억의 조각 화면에서 이 옷을 먼저 선물해 주세요.");
    return;
  }
  style[key] = value;
  write(STORE.farmer, style);
  renderFarmerStyle();
  toast("농부 캐릭터에 바로 적용했어요.");
}

function renderFarmGrowth() {
  const farm = farmGrowth();
  if (!$(".farm-grow-bed")) return;
  const memoryBalance = Number(read(STORE.cash, 0));
  const now = Date.now();
  $$(".farm-grow-bed").forEach((bed) => {
    const id = bed.dataset.plot;
    const plot = farm.plots[id];
    bed.dataset.growth = String(plot.stage);
    bed.classList.toggle("active", id === farm.active);
    bed.classList.toggle("seed-locked", !plot.planted);
    bed.classList.toggle("waiting", plot.planted && plot.readyAt > now);
    bed.classList.toggle("rainbow-quality", plot.quality === "rainbow");
    $$(".crop-sprite", bed).forEach((crop, index) => {
      crop.textContent = plot.planted ? CROP_TYPES[id].stages[plot.stage] : "·";
      crop.style.setProperty("--crop-delay", `${index * 70}ms`);
    });
  });
  $$('[data-crop-plot]').forEach((button) => {
    const plot = farm.plots[button.dataset.cropPlot];
    const active = button.dataset.cropPlot === farm.active;
    button.classList.toggle("active", active);
    button.classList.toggle("seed-locked", !plot.planted && memoryBalance < MEMORY_PLANT_COST);
    button.setAttribute("aria-selected", String(active));
    button.disabled = farmActionBusy;
  });
  const activePlot = farm.plots[farm.active];
  const crop = CROP_TYPES[farm.active];
  const remaining = Math.max(0, activePlot.readyAt - now);
  const cooling = remaining > 0;
  const messages = [
    "기억의 조각이 작은 뿌리를 내렸어요.",
    `${crop.name} 새싹이 흙을 뚫고 올라왔어요!`,
    "잎이 무성해졌어요. 한 번만 더 돌봐요.",
    crop.ripe,
  ];
  $("#cropName").textContent = crop.name;
  if (!activePlot.planted) {
    $("#cropGrowthText").textContent = memoryBalance >= MEMORY_PLANT_COST
      ? "기억의 조각 하나를 이 자리에 바로 심어보세요."
      : "청소 미션을 마치면 나무가 될 기억의 조각이 생겨요.";
  } else {
    $("#cropGrowthText").textContent = messages[activePlot.stage];
  }
  $$(".crop-growth-meter i").forEach((dot, index) => dot.classList.toggle("on", index < activePlot.stage));
  $("#cropInterval").textContent = `성장 간격 ${crop.intervalLabel} · 열매 ${crop.totalLabel}`;
  $("#cropQuality").textContent = activePlot.quality === "rainbow" ? "✨ 무지갯빛" : "초록빛";
  $("#cropQuality").classList.toggle("premium", activePlot.quality === "rainbow");
  $("#cropTimer").textContent = !activePlot.planted
    ? (memoryBalance >= MEMORY_PLANT_COST ? "기억의 조각 심기 가능" : "기억의 조각 필요")
    : cooling
      ? `${activePlot.stage >= 3 ? "기억 열매" : "다음 물주기"}까지 ${formatCropTime(remaining)}`
      : activePlot.stage >= 3 ? "지금 기억 열매 받기" : "지금 물주기 가능";
  $("#cropTimer").classList.toggle("waiting", cooling);
  $("#cropTimer").classList.toggle("ready", activePlot.planted && !cooling);
  $("#plantSeed").classList.toggle("hidden", activePlot.planted);
  $("#plantSeed").textContent = memoryBalance >= MEMORY_PLANT_COST ? "✦ 기억의 조각 심기 · 1조각" : "청소 미션으로 기억의 조각 만들기";
  $("#rainbowCrop").classList.toggle("hidden", !activePlot.planted);
  $("#rainbowCrop").disabled = farmActionBusy || activePlot.quality === "rainbow";
  $("#rainbowCrop").textContent = activePlot.quality === "rainbow" ? "✨ 무지갯빛 나무로 자라는 중" : "🌈 무지개 꽃물 뿌리기 · 3조각";
  $("#waterCrop").classList.toggle("hidden", !activePlot.planted || activePlot.stage >= 3);
  $("#harvestCrop").classList.toggle("hidden", !activePlot.planted || activePlot.stage < 3);
  $("#waterCrop").disabled = farmActionBusy || cooling;
  $("#harvestCrop").disabled = farmActionBusy || cooling;
  $("#waterCrop").textContent = cooling ? `💧 다음 물주기 ${formatCropTime(remaining)}` : "💧 캐릭터와 물 주기";
  const rewardedToday = cashEvents().some((event) => event.key === `${today()}:farm-harvest-${farm.active}`);
  const harvestReward = activePlot.quality === "rainbow" ? 8 : 5;
  $("#harvestCrop").textContent = cooling
    ? `🧺 기억 열매까지 ${formatCropTime(remaining)}`
    : rewardedToday ? "🧺 기억 열매 받기" : `🧺 기억 열매 받기 · +${harvestReward}조각`;
  const worker = $(".farm-worker");
  worker.dataset.plot = farm.active;
  if (!worker.classList.contains("watering") && !worker.classList.contains("rainbowing") && !worker.classList.contains("harvesting")) {
    $("#workerSpeech").textContent = !activePlot.planted
      ? (memoryBalance >= MEMORY_PLANT_COST ? "기억의 조각을 심을 자리를 골라줘!" : "청소 미션으로 나무의 기억을 만들어보자!")
      : cooling ? `${crop.name}이 천천히 자라고 있어!` : `${crop.name}를 같이 돌봐볼까?`;
  }
}

function selectCropPlot(id) {
  if (farmActionBusy || !CROP_TYPES[id]) return;
  const farm = farmGrowth();
  farm.active = id;
  write(STORE.farmGrowth, farm);
  renderFarmGrowth();
}

function focusFarmForAction() {
  if (window.innerWidth > 980) return 0;
  $(".care-farm").scrollIntoView({ behavior: "smooth", block: "center" });
  return 420;
}

function plantSeed() {
  if (farmActionBusy) return;
  if (Number(read(STORE.cash, 0)) < MEMORY_PLANT_COST) {
    toast("청소 미션을 마치면 나무가 될 기억의 조각이 생겨요.");
    showView("mission");
    return;
  }
  const farm = farmGrowth();
  const plot = farm.plots[farm.active];
  if (plot.planted) return;
  if (!spendMemories(`${farm.active}-${Date.now()}`, MEMORY_PLANT_COST, `${CROP_TYPES[farm.active].name} 심기`, "tree")) return;
  plot.planted = true;
  plot.stage = 0;
  plot.readyAt = 0;
  plot.quality = "standard";
  plot.cycleId = Date.now();
  write(STORE.farmGrowth, farm);
  renderFarmGrowth();
  toast(`기억의 조각이 ${CROP_TYPES[farm.active].name}의 씨앗이 되었어요.`);
}

function waterCrop() {
  const farm = farmGrowth();
  const plot = farm.plots[farm.active];
  if (farmActionBusy || plot.stage >= 3) return;
  if (!plot.planted) {
    plantSeed();
    return;
  }
  if (plot.readyAt > Date.now()) {
    toast(`다음 물주기까지 ${formatCropTime(plot.readyAt - Date.now())} 남았어요.`);
    return;
  }
  farmActionBusy = true;
  const plotId = farm.active;
  const crop = CROP_TYPES[plotId];
  const bed = $(`.farm-grow-bed[data-plot="${farm.active}"]`);
  const worker = $(".farm-worker");
  worker.dataset.plot = plotId;
  renderFarmGrowth();
  const delay = focusFarmForAction();
  setTimeout(() => {
    plot.stage += 1;
    plot.readyAt = Date.now() + crop.intervalMs;
    write(STORE.farmGrowth, farm);
    worker.classList.add("watering");
    bed.classList.add("watering");
    $("#workerSpeech").textContent = `${crop.name} 뿌리 쪽으로 촉촉하게!`;
    renderFarmGrowth();
    setTimeout(() => {
      worker.classList.remove("watering");
      bed.classList.remove("watering");
      farmActionBusy = false;
      renderFarmGrowth();
      toast(plot.stage === 3
        ? `${crop.name}에 기억 열매가 맺히는 중이에요 · ${crop.intervalLabel} 후 만나요.`
        : `물을 직접 줬어요 · ${crop.intervalLabel} 후 다시 돌봐요.`);
    }, 2100);
  }, delay);
}

function rainbowCrop() {
  const farm = farmGrowth();
  const plotId = farm.active;
  const plot = farm.plots[plotId];
  if (farmActionBusy || !plot.planted || plot.quality === "rainbow") return;
  if (!plot.cycleId) plot.cycleId = Date.now();
  if (!spendMemories(`${plotId}-${plot.cycleId}`, 3, `${CROP_TYPES[plotId].name} 무지개 꽃물`, "rainbow")) return;
  plot.quality = "rainbow";
  write(STORE.farmGrowth, farm);
  farmActionBusy = true;
  const worker = $(".farm-worker");
  const bed = $(`.farm-grow-bed[data-plot="${plotId}"]`);
  worker.dataset.plot = plotId;
  renderFarmGrowth();
  const delay = focusFarmForAction();
  setTimeout(() => {
    worker.classList.add("rainbowing");
    bed.classList.add("rainbowing");
    $("#workerSpeech").textContent = "무지개 꽃물을 골고루 톡톡 뿌려줄게!";
    renderFarmGrowth();
    setTimeout(() => {
      worker.classList.remove("rainbowing");
      bed.classList.remove("rainbowing");
      farmActionBusy = false;
      renderFarmGrowth();
      toast(`${CROP_TYPES[plotId].name}이 ✨ 무지갯빛으로 자라요 · 기억 열매 +8조각`);
    }, 2100);
  }, delay);
}

function harvestCrop() {
  const farm = farmGrowth();
  const plot = farm.plots[farm.active];
  if (farmActionBusy || plot.stage < 3) return;
  if (plot.readyAt > Date.now()) {
    toast(`기억 열매까지 ${formatCropTime(plot.readyAt - Date.now())} 남았어요.`);
    return;
  }
  farmActionBusy = true;
  const plotId = farm.active;
  const quality = plot.quality;
  const bed = $(`.farm-grow-bed[data-plot="${plotId}"]`);
  const worker = $(".farm-worker");
  worker.dataset.plot = plotId;
  renderFarmGrowth();
  const delay = focusFarmForAction();
  setTimeout(() => {
    worker.classList.add("harvesting");
    bed.classList.add("harvesting");
    $("#workerSpeech").textContent = "잘 자란 기억 열매를 바구니에 담자!";
    renderFarmGrowth();
    setTimeout(() => {
      const latest = farmGrowth();
      latest.plots[plotId].stage = 0;
      latest.plots[plotId].planted = false;
      latest.plots[plotId].readyAt = 0;
      latest.plots[plotId].quality = "standard";
      latest.plots[plotId].cycleId = 0;
      latest.plots[plotId].harvests += 1;
      write(STORE.farmGrowth, latest);
      const rewardAmount = quality === "rainbow" ? 8 : 5;
      const qualityLabel = quality === "rainbow" ? "무지갯빛 " : "";
      const rewarded = reward(`farm-harvest-${plotId}`, rewardAmount, `${qualityLabel}${CROP_TYPES[plotId].name} 기억 열매`);
      if (!rewarded) toast(`${qualityLabel}${CROP_TYPES[plotId].name}의 기억 열매를 받았어요 · 누적 ${latest.plots[plotId].harvests}번`);
      renderFarmGrowth();
    }, 850);
    setTimeout(() => {
      worker.classList.remove("harvesting");
      bed.classList.remove("harvesting");
      farmActionBusy = false;
      renderFarmGrowth();
    }, 1450);
  }, delay);
}

function renderSpendShop() {
  updateCounters();
  const balance = Number(read(STORE.cash, 0));
  const owned = ownedDecor();
  const ownedOutfits = ownedFarmerOutfits();
  const selectedGifts = read(STORE.gifts, []);
  $$('[data-decor-count]').forEach((el) => { el.textContent = owned.length; });
  const decorGrid = $("#decorGrid");
  const outfitGrid = $("#outfitGrid");
  const giftGrid = $("#giftGrid");
  if (!decorGrid || !outfitGrid || !giftGrid) return;
  decorGrid.innerHTML = DECOR_ITEMS.map((item) => {
    const isOwned = owned.includes(item.id);
    const canBuy = balance >= item.cost && !isOwned;
    return `<article class="spend-card ${isOwned ? "owned" : ""}"><div class="spend-icon">${item.icon}</div><div><h3>${item.title}</h3><p>${item.body}</p></div><button class="${isOwned ? "secondary" : "primary"}" data-buy-decor="${item.id}" ${canBuy ? "" : "disabled"}>${isOwned ? "내 농장에 있어요 ✓" : `${item.cost}조각으로 꾸미기`}</button></article>`;
  }).join("");
  outfitGrid.innerHTML = OUTFIT_ITEMS.map((item) => {
    const isOwned = ownedOutfits.includes(item.id);
    const canBuy = balance >= item.cost && !isOwned;
    return `<article class="spend-card outfit-card ${isOwned ? "owned" : ""}"><div class="spend-icon">${item.icon}</div><div><h3>${item.title}</h3><p>${item.body}</p></div><button class="${isOwned ? "secondary" : "primary"}" data-buy-outfit="${item.id}" ${canBuy ? "" : "disabled"}>${isOwned ? "내 옷장에 있어요 ✓" : `${item.cost}조각으로 선물하기`}</button></article>`;
  }).join("");
  giftGrid.innerHTML = GIFT_ITEMS.map((item) => {
    const isSelected = selectedGifts.some((gift) => gift.id === item.id);
    const canBuy = balance >= item.cost && !isSelected;
    return `<article class="spend-card gift-card ${isSelected ? "owned" : ""}"><div class="spend-icon">${item.icon}</div><div><h3>${item.title}</h3><p>${item.body}</p></div><button class="${isSelected ? "secondary" : "primary"}" data-select-gift="${item.id}" ${canBuy ? "" : "disabled"}>${isSelected ? "선택했어요 ✓" : `${item.cost}조각으로 선택`}</button></article>`;
  }).join("");
  $("#giftHistory").innerHTML = selectedGifts.length ? `<h3>내가 고른 기프티콘</h3>${selectedGifts.map((gift) => `<div class="gift-history-row"><span>${gift.icon}</span><div><b>${escapeHtml(gift.title)}</b><small>${new Date(gift.selectedAt).toLocaleString("ko-KR")} 선택</small></div><strong>${gift.cost}조각</strong></div>`).join("")}` : "";
  $$('[data-buy-decor]').forEach((button) => button.addEventListener("click", () => purchaseDecor(DECOR_ITEMS.find((item) => item.id === button.dataset.buyDecor))));
  $$('[data-buy-outfit]').forEach((button) => button.addEventListener("click", () => purchaseFarmerOutfit(OUTFIT_ITEMS.find((item) => item.id === button.dataset.buyOutfit))));
  $$('[data-select-gift]').forEach((button) => button.addEventListener("click", () => selectGift(GIFT_ITEMS.find((item) => item.id === button.dataset.selectGift))));
}

function saveHistory(extra = {}) {
  const list = read(STORE.history, []);
  const record = {
    id: `mission-${today()}`,
    date: new Date().toISOString(),
    area: $("#careArea").value,
    categories: careContext().categories,
    guideType: "home_care",
    completed: true,
    beforeAfter: false,
    ...extra,
  };
  const index = list.findIndex((x) => x.id === record.id);
  if (index >= 0) list[index] = { ...list[index], ...record }; else list.unshift(record);
  write(STORE.history, list.slice(0, 50));
}

async function imageData(file) {
  if (!file) throw new Error("사진을 선택해주세요.");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("JPG, PNG, WEBP 사진만 사용할 수 있어요.");
  if (file.size > 10 * 1024 * 1024) throw new Error("사진 한 장은 10MB 이하여야 해요.");
  const original = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(file); });
  const scale = Math.min(1, 1600 / Math.max(original.width, original.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(original.width * scale); canvas.height = Math.round(original.height * scale);
  canvas.getContext("2d").drawImage(original, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(original.src);
  return canvas.toDataURL("image/jpeg", .8);
}

function bindImage(inputId, previewId, key, onReady) {
  const input = $(`#${inputId}`), preview = $(`#${previewId}`);
  if (!input || !preview) return;
  input.addEventListener("change", async () => {
    try {
      const data = await imageData(input.files[0]); state.images[key] = data; preview.src = data; preview.parentElement.classList.add("has-image");
      if (key === "area") $("#compareBeforePreview").src = data;
      if (key === "after") $("#compareAfterPreview").src = data;
      if (onReady) onReady();
    } catch (e) { input.value = ""; toast(e.message); }
  });
}

async function analyzeArea() {
  if (!state.images.area) return toast("청소 전 사진을 먼저 선택해주세요.");
  loading(true, "사진에서 보이는 특징을 살펴보고 있어요");
  try {
    const context = careContext();
    const data = await post("/api/analyze", { mode: "cleaning_area", images: [state.images.area], context });
    if (data.manual_required) {
      $("#areaSummary").textContent = data.message + " 선택한 할 일로 계속할 수 있어요.";
      $("#observations").innerHTML = "<span>직접 확인 모드</span>";
    } else {
      $("#areaSummary").textContent = `AI가 사진에서 보이는 할 일을 살폈어요. 실제 공간을 보고 수정해주세요.`;
      $("#observations").innerHTML = (data.observations || []).map((x) => `<span>${escapeHtml(x)}</span>`).join("") || "<span>관찰 근거 없음</span>";
      if (LABELS.focus[data.cleaning_focus]) $("#cleaningFocus").value = data.cleaning_focus;
    }
    renderCareSummary();
    goStep(2);
  } catch (e) {
    $("#areaSummary").textContent = "분석이 어려워요. 직접 선택해서 계속할 수 있어요.";
    toast(e.message); goStep(2);
  } finally { loading(false); }
}

async function confirmArea() {
  if (!$("#areaConfirmed").checked) return toast("실제 오염과 비교했다는 확인이 필요해요.");
  const context = careContext();
  if (!context.categories.length) return toast("정리할 것, 청소할 것, 세탁할 것 중 하나 이상을 골라주세요.");

  loading(true, "검수된 청소 방법을 불러오고 있어요");
  let guide;
  try {
    guide = await post("/api/cleaning-guide", {
      locale: "ko-KR",
      area_hint: context.area,
      visible_categories: context.categories,
      cleaning_focus: context.focus,
      user_confirmed: true,
      observations: $$("#observations span").map((item) => item.textContent.trim()).filter(Boolean),
    });
  } catch (error) {
    guide = buildFallbackGuide(context);
    toast("지식 DB 연결이 어려워 기본 6단계 안내로 계속해요.");
  } finally {
    loading(false);
  }

  state.guide = normalizeGuideForDisplay(guide, context);
  const sourceText = guide.knowledge_source === "supabase_release"
    ? "검수된 Supabase 지식 릴리스"
    : guide.mode === "local_fallback" ? "검수된 로컬 지식 스냅샷" : "검수된 청소 지식";
  $("#guideIntro").textContent = `${guide.title || LABELS.area[context.area]} · ${sourceText}를 바탕으로 한 상세 순서예요.`;
  saveHistory({ completed: false, awaitingPhotoVerification: true });
  renderScenario();
  goStep(3);
}

function careContext() {
  const focus = $("#cleaningFocus")?.value || "unknown";
  const category = focus === "laundry" ? "laundry" : focus === "clutter" ? "organize" : "clean";
  return { area: $("#careArea").value, categories: [category], focus };
}
function renderCareSummary() { const context = careContext(); $("#selectedCareSummary").innerHTML = [`장소 · ${LABELS.area[context.area]}`, `사진에서 확인할 문제 · ${LABELS.focus[context.focus]}`].map((text) => `<span>${escapeHtml(text)}</span>`).join(""); }

function preferredCareType(context) {
  if (context.focus === "laundry" && context.categories.includes("laundry")) return "laundry";
  if (context.focus === "clutter" && context.categories.includes("organize")) return "organize";
  if (context.categories.includes("clean")) return "clean";
  if (context.categories.includes("organize")) return "organize";
  return "laundry";
}

function normalizeGuideForDisplay(guide, context) {
  const kind = preferredCareType(context);
  const sources = Array.isArray(guide.sources) ? guide.sources : [];
  const stopText = (guide.stop_rules || []).map((rule) => rule.user_action).filter(Boolean).join(" ");
  const steps = (guide.steps || []).map((step) => ({
    title: step.instruction,
    body: step.detail,
    completion: step.completion_cue || "이 단계에서 정한 작은 범위를 확인했어요.",
    pause: [step.caution, stopText].filter(Boolean).join(" ") || "불편하거나 위험하다고 느껴지면 멈추고, 무리하지 않아도 괜찮아요.",
    tips: (step.tips || []).map((tip) => tip.text).filter(Boolean),
    sourceIds: [...new Set([...(step.source_ids || []), ...(step.tips || []).flatMap((tip) => tip.source_ids || [])])],
    kind,
  }));
  return { ...guide, sources, steps: steps.length ? steps : normalizeGuideForDisplay(buildFallbackGuide(context), context).steps };
}

function buildFallbackGuide(context) {
  const kind = preferredCareType(context);
  const plans = {
    clean: [
      ["주변을 비우고 환기하기", "작업할 작은 구역만 정하고 주변 물건과 큰 이물질을 먼저 치워요.", "닦을 면이 보이고 이동할 때 걸리는 것이 없어요."],
      ["마른 부스러기부터 걷기", "부드러운 천이나 브러시로 눈에 보이는 먼지와 부스러기를 먼저 모아 버려요.", "표면에 움직이는 큰 이물질이 남지 않았어요."],
      ["작은 부분을 먼저 확인하기", "물로 닦아도 된다고 확인한 표면만 물기를 꼭 짠 부드러운 천으로 작은 곳부터 닦아요.", "표면의 색이나 상태가 달라지지 않았어요."],
      ["한 방향으로 나누어 닦기", "확인한 작은 구역을 겹치지 않게 나누고 천의 깨끗한 면으로 바꿔가며 닦아요.", "처음 정한 작은 구역을 빠뜨리지 않고 닦았어요."],
      ["남은 물기 걷기", "마른 부드러운 천으로 남은 물기를 눌러 닦고 공기가 통하게 해요.", "고인 물기가 보이지 않아요."],
      ["도구와 주변 정리하기", "사용한 도구를 치우고 처음 정한 범위를 다시 확인해요.", "도구가 정리되고 다음 시작점이 보여요."],
    ],
    organize: [
      ["작은 구역 하나만 정하기", "서랍 한 칸이나 바닥 한 면처럼 지금 끝낼 범위를 작게 정해요.", "정리할 경계가 눈에 보여요."],
      ["위험한 물건 먼저 분리하기", "깨지거나 날카롭거나 무거운 물건은 억지로 옮기지 말고 따로 표시해요.", "바로 손대기 어려운 물건이 분리됐어요."],
      ["남길 것과 옮길 것 나누기", "지금 쓸 것, 제자리로 옮길 것, 비울 것을 각각 모아요.", "섞여 있던 물건이 세 갈래로 나뉘었어요."],
      ["자주 쓰는 것부터 놓기", "오늘 필요한 물건만 손이 닿는 자리에 놓고 나머지는 제자리로 옮겨요.", "지금 쓸 물건을 바로 찾을 수 있어요."],
      ["통로와 문 확인하기", "정리한 물건이 걷는 길이나 문을 막지 않는지 확인해요.", "통로와 문이 막히지 않았어요."],
      ["남은 한 묶음 기록하기", "오늘 다루지 않은 것은 한곳에 모아 다음 시작점으로 남겨요.", "완료한 범위와 다음 범위가 구분돼요."],
    ],
    laundry: [
      ["세탁할 것만 모으기", "천·의류·침구처럼 세탁할 것만 한 바구니에 모아요.", "다른 물건이 바구니에 섞이지 않았어요."],
      ["상태가 다른 것은 분리하기", "색이나 상태가 다른 것은 서로 섞지 않고 따로 두어요.", "확인이 필요한 세탁물이 분리됐어요."],
      ["작은 소지품 확인하기", "주머니와 접힌 부분에 남은 물건이 없는지 눈으로 확인해요.", "보이는 소지품을 모두 꺼냈어요."],
      ["확실한 것부터 처리하기", "세탁 방법을 알고 있는 것부터 진행하고 모르는 것은 따로 남겨요.", "확실하지 않은 세탁물이 따로 있어요."],
      ["완전히 펼쳐 말리기", "처리한 천은 겹치지 않게 펼쳐 공기가 통하도록 말려요.", "젖은 부분이 뭉쳐 있지 않아요."],
      ["마른 것만 제자리에 두기", "완전히 마른 것만 접거나 걸어 제자리에 두어요.", "젖은 천이 수납 안에 남지 않았어요."],
    ],
  };
  return {
    mode: "local_fallback",
    title: `${LABELS.area[context.area]} 기본 6단계`,
    stop_rules: [],
    sources: [],
    knowledge_source: "local_release_snapshot",
    steps: plans[kind].map(([instruction, detail, completion], index) => ({
      instruction,
      detail,
      completion_cue: completion,
      caution: index === 1 ? "무겁거나 날카롭거나 전기와 가까운 부분은 무리해서 다루지 마세요." : null,
      tips: [],
      source_ids: [],
    })),
  };
}

function renderScenario() {
  const steps = state.guide?.steps || [];
  const sourceById = new Map((state.guide?.sources || []).map((source) => [source.id, source]));
  $("#guideSteps").innerHTML = steps.map((item, index) => {
    const tips = (item.tips || []).length ? `<ul>${item.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>` : "";
    const sources = (item.sourceIds || []).map((id) => sourceById.get(id)).filter(Boolean);
    const sourceLinks = sources.length ? `<details><summary>검수 출처</summary><ul>${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.publisher)} · ${escapeHtml(source.title)}</a></li>`).join("")}</ul></details>` : "";
    return `<article class="guide-step-card"><span class="guide-step-number">${String(index + 1).padStart(2, "0")}</span><div><span class="kicker">${escapeHtml(LABELS.careType[item.kind] || "집안 돌봄")} · STEP ${index + 1}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p><aside><strong>이 정도면 충분해요</strong><p>${escapeHtml(item.completion)}</p></aside>${tips ? `<aside class="guide-tips"><strong>단계 팁</strong>${tips}</aside>` : ""}<aside class="guide-pause"><strong>멈추고 확인할 것</strong><p>${escapeHtml(item.pause || "불편하거나 위험하다고 느껴지면 멈추고, 무리하지 않아도 괜찮아요.")}</p></aside>${sourceLinks}</div><button class="outline guide-speak" type="button" data-speak-guide-step="${index}">▷ 음성으로 듣기</button></article>`;
  }).join("");
  $$('[data-speak-guide-step]').forEach((button) => button.addEventListener("click", () => speakStep(Number(button.dataset.speakGuideStep))));
}

function speakStep(index) {
  if (!("speechSynthesis" in window)) return toast("이 브라우저에서는 음성 안내를 지원하지 않아요.");
  const item = state.guide?.steps?.[index];
  if (!item) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`${item.title}. ${item.body}. 이 정도면 충분해요. ${item.completion}`);
  utterance.lang = "ko-KR"; utterance.rate = .9; speechSynthesis.speak(utterance);
}

async function comparePhotos() {
  if (!state.images.area || !state.images.after) return toast("청소 전·후 사진을 모두 선택해주세요.");
  loading(true, "전후 사진에서 보이는 변화를 확인하고 있어요");
  try {
    const pairHash = await photoPairHash(state.images.area, state.images.after);
    const usedPairs = read(STORE.photoPairs, []);
    if (usedPairs.includes(pairHash)) {
      toast("같은 전후 사진 조합은 이미 확인했어요. 기억의 조각은 한 번만 남아요.");
      return;
    }
    const data = await post("/api/analyze", { mode: "before_after", images: [state.images.area, state.images.after], context: careContext() });
    if (data.manual_required) {
      $("#compareResult").innerHTML = `<div class="result-card unknown"><h2>전후 사진은 준비됐어요</h2><p>AI 연결 전이라 사진으로 완료 단계를 확인할 수 없어요. 체크리스트는 사진 비교가 가능할 때 열려요.</p></div>`;
    } else if (!data.same_target) {
      $("#compareResult").innerHTML = `<div class="result-card unknown"><h2>같은 위치인지 확인하기 어려워요</h2><p>기억의 조각은 남기지 않았어요. 다음에는 비슷한 구도로 촬영하면 변화를 더 쉽게 확인할 수 있어요.</p></div>`;
    } else {
      const changes = [...(data.changes || []), ...(data.remaining_areas || [])];
      const completed = renderComparisonChecklist(data.mission_checks || {}, data.mission_evidence || {}, pairHash);
      $("#compareResult").innerHTML = `<div class="result-card allowed"><h2>전후 사진에서 보이는 변화를 정리했어요</h2><p>${completed ? `${completed}개 미션의 완료 흔적을 확인했어요.` : "완료로 확실히 볼 수 있는 단계는 아직 없어요."}</p>${changes.length ? `<ul>${changes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}</div>`;
      write(STORE.photoPairs, [...usedPairs, pairHash].slice(-100));
      saveHistory({ beforeAfter: true, completed: completed > 0, photoMissionCount: completed });
      const enoughProgressToComplete = completed >= 1;
      if (enoughProgressToComplete) {
        const areas = completedAreas();
        if (!areas.includes(careContext().area)) write(STORE.completedAreas, [...areas, careContext().area]);
        $("#startNewMission").classList.remove("hidden");
      }
      write(STORE.badges, Number(read(STORE.badges, 0)) + (cashEvents().some((e) => e.key === `${today()}:before-after-badge`) ? 0 : 1));
      const events = cashEvents(); if (!events.some((e) => e.key === `${today()}:before-after-badge`)) { events.unshift({ key: `${today()}:before-after-badge`, amount: 0, title: "전후 기록 인증 배지", at: new Date().toISOString() }); write(STORE.events, events); }
      updateCounters();
      renderSpendShop(); renderRoom();
    }
  } catch (e) { toast(e.message); }
  finally { loading(false); }
}

async function photoPairHash(before, after) {
  const bytes = new TextEncoder().encode(`${before}\n--photo-pair--\n${after}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function renderComparisonChecklist(checks, evidence, pairHash) {
  const descriptions = {
    organize: "물건이 분류되거나 제자리에 놓여 공간이 정리된 모습이 보여요.",
    clean: "먼지·부스러기·얼룩처럼 사진에서 보이던 흔적이 줄어든 모습이 보여요.",
    laundry: "세탁할 천·의류·침구가 분리·수거되거나 정돈된 모습이 보여요.",
  };
  const missions = careContext().categories.map((type, index) => [type, `${index + 1}단계 · ${LABELS.careType[type]}`, descriptions[type]]);
  const done = missions.filter(([key]) => checks[key]);
  $("#comparisonChecklist").classList.remove("hidden");
  $("#comparisonChecklist").innerHTML = `<h3>사진 비교 체크리스트</h3><p>같은 위치의 전후 사진에서 확인한 근거예요. 체크된 단계마다 안내 미션 한 단계와 같은 기억의 조각 ${CARE_STEP_MEMORY}개가 남습니다.</p>${missions.map(([key, title, body]) => { const notes = Array.isArray(evidence[key]) ? evidence[key] : []; const detail = checks[key] && notes.length ? notes.join(" · ") : body; return `<div class="comparison-item ${checks[key] ? "done" : ""}"><span>${checks[key] ? "✓" : "·"}</span><div><b>${title}</b><small>${escapeHtml(detail)}</small></div><em>${checks[key] ? `+${CARE_STEP_MEMORY}조각` : "확인 필요"}</em></div>`; }).join("")}`;
  done.forEach(([key, title]) => reward(`photo-mission-${key}`, CARE_STEP_MEMORY, `${title} 사진 확인`));
  return done.length;
}

const GARDEN_STAGES = [
  { label: "텃밭", icon: "▦", title: "텃밭에서 시작해요", message: "첫 청소 미션을 마치면 기억의 조각 씨앗이 심어져요." },
  { label: "기억의 조각 씨앗", icon: "✦", title: "기억의 조각 씨앗이 심어졌어요", message: "첫 미션에서 남긴 조각이 텃밭의 시작이 되었어요." },
  { label: "새싹", icon: "🌱", title: "새싹이 올라왔어요", message: "청소 미션을 하나 더 마치면 새싹이 자라요." },
  { label: "작은 나무", icon: "🌳", title: "작은 나무가 되었어요", message: "작은 행동이 차곡차곡 나무의 줄기가 되고 있어요." },
  { label: "큰 나무", icon: "🌲", title: "큰 나무가 자랐어요", message: "계속 이어온 돌봄이 텃밭을 든든하게 채워요." },
  { label: "과수원", icon: "🍎", title: "나만의 과수원이 되었어요", message: "청소 미션으로 남긴 기억이 풍성한 과수원이 되었어요." },
];
const GARDEN_CROPS = [
  { name: "토마토", sprout: "🌱", tree: "🍅" },
  { name: "딸기", sprout: "🌱", tree: "🍓" },
  { name: "바질", sprout: "🌱", tree: "🌿" },
  { name: "당근", sprout: "🌱", tree: "🥕" },
];
function plantRandomGardenSeed() {
  if (read(STORE.gardenCrop, null)) return;
  write(STORE.gardenCrop, GARDEN_CROPS[Math.floor(Math.random() * GARDEN_CROPS.length)]);
}

function completedGardenMissions() {
  return read(STORE.history, []).filter((record) => record.completed && (record.beforeAfter || record.plannedCompleted)).length;
}

function renderRoom() {
  if (!$("#gardenStageLabel")) return;
  const progress = Math.min(5, completedGardenMissions());
  const stage = GARDEN_STAGES[progress];
  const crop = read(STORE.gardenCrop, null);
  $(".simple-garden").dataset.gardenStage = String(progress);
  $("#gardenStageIcon").textContent = crop && progress > 0 ? (progress < 3 ? crop.sprout : crop.tree) : stage.icon;
  $("#gardenStageLabel").textContent = crop && progress > 0 ? `${crop.name} ${stage.label}` : stage.label;
  $("#gardenStageHint").textContent = progress === 5 ? "이 텃밭은 계속 이어온 돌봄의 기억으로 가득해요." : "다음 청소 미션을 마치면 다음 모습으로 자라요.";
  $("#roomTitle").textContent = stage.title;
  $("#roomMessage").textContent = stage.message;
  $("#roomProgressCount").textContent = progress;
  $("#roomProgressBar").style.width = `${(progress / 5) * 100}%`;
  $$(".garden-stage-list li").forEach((item, index) => item.classList.toggle("active", index <= progress));
}

const roomSurface = $(".care-room");
roomSurface?.addEventListener("pointermove", (event) => {
  if (roomSurface.classList.contains("webgl-ready")) return;
  const rect = roomSurface.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  roomSurface.style.setProperty("--fallback-rx", `${-y * 2.2}deg`);
  roomSurface.style.setProperty("--fallback-ry", `${x * 3.2}deg`);
});
roomSurface?.addEventListener("pointerleave", () => {
  roomSurface.style.setProperty("--fallback-rx", "0deg");
  roomSurface.style.setProperty("--fallback-ry", "0deg");
});

const PLAN_AREAS = ["desk", "sink", "bathroom", "kitchen", "bed", "sofa", "shoe_rack"];
const PLAN_TASKS = {
  desk: "책상 위 한 구역을 비우고 가볍게 닦기",
  sink: "싱크대 주변의 물기와 작은 부스러기 정리하기",
  bathroom: "욕실에서 눈에 보이는 한 곳만 닦고 물기 걷기",
  kitchen: "주방 조리대 한 면을 비우고 닦기",
  bed: "침구를 펴고 침대 주변 한 가지 정리하기",
  sofa: "소파 위 물건을 제자리에 두고 쿠션 정돈하기",
  shoe_rack: "현관 신발 한 켤레와 바닥 주변 정리하기",
};
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function mondayKey(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy.toLocaleDateString("en-CA");
}
function planDate(weekStart, index) { const date = new Date(`${weekStart}T12:00:00`); date.setDate(date.getDate() + index); return date.toLocaleDateString("en-CA"); }
function createWeeklyPlan(areas) {
  const weekStart = mondayKey();
  return { weekStart, areas, tasks: DAY_LABELS.map((day, index) => {
    const area = areas[index % areas.length];
    return { date: planDate(weekStart, index), day, area, task: PLAN_TASKS[area] };
  }) };
}
function activeWeeklyPlan() {
  const plan = read(STORE.weeklyPlan, null);
  if (!plan?.areas?.length) return null;
  if (plan.weekStart === mondayKey()) return plan;
  const refreshed = createWeeklyPlan(plan.areas);
  write(STORE.weeklyPlan, refreshed);
  return refreshed;
}
function todayPlan(plan = activeWeeklyPlan()) { return plan?.tasks.find((task) => task.date === today()) || plan?.tasks[0]; }
function planRecord(task) { return read(STORE.history, []).find((record) => record.id === `weekly-${task.date}`); }
function renderWeeklyPlan() {
  const setup = $("#planSetup"), tracker = $("#weeklyTracker");
  if (!setup || !tracker) return;
  const plan = activeWeeklyPlan();
  setup.classList.toggle("hidden", !!plan);
  tracker.classList.toggle("hidden", !plan);
  if (!plan) {
    if (!state.planAreas.length) state.planAreas = ["desk", "bathroom", "sink"];
    $("#planAreaCards").innerHTML = PLAN_AREAS.map((area) => `<button type="button" class="plan-area-card ${state.planAreas.includes(area) ? "selected" : ""}" data-plan-area="${area}" aria-pressed="${state.planAreas.includes(area)}"><span>${({ desk: "🖥️", sink: "🚰", bathroom: "🛁", kitchen: "🍳", bed: "🛏️", sofa: "🛋️", shoe_rack: "👟" })[area]}</span><b>${LABELS.area[area]}</b></button>`).join("");
    $$('[data-plan-area]').forEach((button) => button.addEventListener("click", () => {
      const area = button.dataset.planArea;
      state.planAreas = state.planAreas.includes(area) ? state.planAreas.filter((item) => item !== area) : [...state.planAreas, area];
      renderWeeklyPlan();
    }));
    return;
  }
  const current = todayPlan(plan);
  $("#weeklyTitle").textContent = `${new Date(`${plan.weekStart}T12:00:00`).getMonth() + 1}월의 작은 계획`;
  $("#weeklyCalendar").innerHTML = plan.tasks.map((task) => {
    const done = !!planRecord(task)?.plannedCompleted;
    const active = task.date === today();
    return `<article class="week-day ${active ? "today" : ""} ${done ? "done" : ""}"><span>${task.day}</span><b>${LABELS.area[task.area]}</b><small>${done ? "기록 완료 ✓" : task.task}</small></article>`;
  }).join("");
  const done = !!planRecord(current)?.plannedCompleted;
  const guide = state.planGuide?.area === current.area ? state.planGuide : null;
  const guideMarkup = guide ? `<section class="plan-guide"><span class="kicker">SUPABASE CLEANING GUIDE</span><h3>${LABELS.area[current.area]} 간단 청소 방법</h3><ol>${guide.steps.slice(0, 4).map((step) => `<li><b>${escapeHtml(step.instruction || step.title)}</b><span>${escapeHtml(step.detail || step.body || "작은 범위만 천천히 진행해요.")}</span></li>`).join("")}</ol></section>` : state.planPhoto ? `<p class="plan-guide-loading">검수된 청소 방법을 불러오는 중이에요.</p>` : "";
  $("#todayPlanCard").innerHTML = `<div><span class="kicker">TODAY · ${current.day}요일</span><h2>${LABELS.area[current.area]} 돌봄</h2><p>${current.task}</p><small>비포·애프터 사진 원본은 저장하지 않아요.</small></div><label class="plan-photo ${state.planPhoto ? "has-image" : ""}"><input id="planPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"><span>${state.planPhoto ? "비포 사진 바꾸기" : "＋ 비포 사진"}</span></label>${guideMarkup}<div class="plan-after-row"><label class="plan-photo ${state.planAfterPhoto ? "has-image" : ""}"><input id="planAfterPhotoInput" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"><span>${state.planAfterPhoto ? "애프터 사진 바꾸기" : "＋ 애프터 사진"}</span></label><button id="completePlanTask" class="primary" ${done ? "disabled" : ""}>${done ? "오늘의 기록 완료 ✓" : "개선 확인하고 새싹 심기"}</button></div>`;
  $("#planPhotoInput").addEventListener("change", async (event) => { try { state.planPhoto = await imageData(event.target.files[0]); state.planGuide = null; renderWeeklyPlan(); await loadWeeklyGuide(current); } catch (error) { toast(error.message); } });
  $("#planAfterPhotoInput").addEventListener("change", async (event) => { try { state.planAfterPhoto = await imageData(event.target.files[0]); renderWeeklyPlan(); } catch (error) { toast(error.message); } });
  $("#completePlanTask").addEventListener("click", () => completePlanTask(current));
}
async function loadWeeklyGuide(task) {
  try {
    const guide = await post("/api/cleaning-guide", { locale: "ko-KR", area_hint: task.area, visible_categories: ["clean"], cleaning_focus: "unknown", user_confirmed: true, observations: [] });
    state.planGuide = { area: task.area, steps: guide.steps || [] };
  } catch {
    state.planGuide = { area: task.area, steps: [
      { instruction: "주변을 비우기", detail: "오늘 정한 작은 범위만 보이게 해요." },
      { instruction: "눈에 보이는 것부터 닦기", detail: "부드러운 천으로 한 방향씩 가볍게 닦아요." },
      { instruction: "물기와 도구 정리", detail: "남은 물기를 걷고 사용한 도구를 제자리에 둬요." },
    ] };
  }
  renderWeeklyPlan();
}
async function completePlanTask(task) {
  if (!state.planPhoto || !state.planAfterPhoto) return toast("비포와 애프터 사진을 각각 한 장씩 남겨주세요.");
  let improved = false;
  loading(true, "전후 사진에서 보이는 변화를 확인하고 있어요");
  try {
    const data = await post("/api/analyze", { mode: "before_after", images: [state.planPhoto, state.planAfterPhoto], context: { area: task.area, visible_categories: ["clean"] } });
    improved = !data.manual_required && data.same_target === true && Object.values(data.mission_checks || {}).some(Boolean);
  } catch { toast("사진 비교가 어려워 기록만 남겼어요."); }
  finally { loading(false); }
  const list = read(STORE.history, []);
  const record = { id: `weekly-${task.date}`, date: new Date().toISOString(), area: task.area, categories: ["clean"], guideType: "weekly_tracker", completed: true, beforeAfter: true, plannedCompleted: true, photoRecorded: true, improved };
  const index = list.findIndex((item) => item.id === record.id);
  if (index >= 0) list[index] = record; else list.unshift(record);
  write(STORE.history, list.slice(0, 50));
  reward(`weekly-plan-${task.date}`, 3, `${LABELS.area[task.area]} 주간 돌봄 기록`);
  if (improved) plantRandomGardenSeed();
  state.planPhoto = null; state.planAfterPhoto = null; state.planGuide = null;
  renderWeeklyPlan(); renderRoom(); renderCash();
  toast(improved ? "개선된 모습을 확인했어요. 랜덤 작물 새싹이 텃밭에 심어졌어요." : "오늘의 돌봄을 기록했어요. 다음에도 비슷한 구도로 남겨보세요.");
}

function renderCash() {
  updateCounters();
  renderSpendShop();
  const events = cashEvents().filter((e) => e.amount !== 0);
  $("#cashEvents").className = events.length ? "" : "empty";
  $("#cashEvents").innerHTML = events.length ? events.map((e) => `<div class="event-row"><div><b>${escapeHtml(e.title)}</b><br><small>${new Date(e.at).toLocaleString("ko-KR")}</small></div><strong class="${e.amount < 0 ? "spent" : "earned"}">${e.amount > 0 ? "+" : ""}${e.amount}조각</strong></div>`).join("") : "아직 기억의 조각 내역이 없어요.";
  $("#recordPlanCount").textContent = read(STORE.history, []).filter((record) => record.plannedCompleted).length;
  renderHistory();
}

function renderHistory() {
  const list = read(STORE.history, []);
  $("#historyCount").textContent = `${list.length}개의 기록`;
  $("#historyList").className = list.length ? "history-list" : "history-list empty";
  $("#historyList").innerHTML = list.length ? list.map((x) => `<div class="history-row"><div><b>${escapeHtml(LABELS.area[x.area] || "돌본 공간")}</b><small>${new Date(x.date).toLocaleString("ko-KR")} · ${x.beforeAfter ? "사진 확인 완료" : x.awaitingPhotoVerification ? "사진 확인 대기" : "기록 완료"}</small></div><span>${escapeHtml((x.categories || []).map((type) => LABELS.careType[type]).join(" · ") || "집안 돌봄")}</span></div>`).join("") : "아직 기록이 없어요.";
}

const DAILY_MISSIONS = [
  ["창문을 열어 5분 환기하기", "공기가 지나갈 길을 하나만 만들어도 충분해요."],
  ["분리수거 한 종류만 정리하기", "페트병이나 종이 중 한 종류만 골라도 좋아요."],
  ["물건 3개를 제자리에 두기", "눈에 보이는 것 중 딱 세 개만 천천히 돌려놓아요."],
  ["세면대 물기 한 번 닦기", "마른 수건으로 눈에 보이는 물기만 가볍게 닦아요."],
  ["쓰레기 하나 골라 버리기", "가장 가까운 것 하나면 오늘의 행동은 완료예요."],
  ["사용한 컵 하나 씻기", "쌓인 양보다 지금 손에 잡히는 컵 하나에만 집중해요."],
  ["수건을 펼쳐 말리기", "젖은 수건 하나를 펴서 통풍이 되는 곳에 걸어주세요."],
  ["현관 신발 한 켤레 정리하기", "자주 신는 한 켤레만 가지런히 놓아도 좋아요."],
  ["침구를 한 번 펼쳐두기", "정돈이 아니라 공기가 통하도록 펼치는 것만 해도 충분해요."],
  ["바닥의 작은 물건 하나 줍기", "공간 전체가 아니라 발밑의 한 가지에만 집중해요."],
];
function renderDailyMission() {
  const planned = todayPlan();
  if (planned) {
    $("#dailyTitle").textContent = `${LABELS.area[planned.area]} 돌봄`;
    $("#dailyBody").textContent = planned.task;
    $("#completeDaily").textContent = planRecord(planned)?.plannedCompleted ? "오늘의 기록 완료 ✓" : "오늘 계획 보기";
    $("#completeDaily").disabled = false;
    return;
  }
  const start = new Date(new Date().getFullYear(), 0, 0);
  const index = Math.floor((new Date() - start) / 86400000) % DAILY_MISSIONS.length;
  const mission = DAILY_MISSIONS[index];
  $("#dailyTitle").textContent = mission[0];
  $("#dailyBody").textContent = mission[1];
  const done = cashEvents().some((e) => e.key === `${today()}:daily-care`);
  $("#completeDaily").textContent = done ? "오늘도 돌봤어요 ✓" : "해냈어요 · +3";
  $("#completeDaily").disabled = done;
}

async function health() {
  try {
    const data = await fetch("/health", { cache: "no-store" }).then((r) => r.json());
    $("#apiStatus").classList.toggle("ready", data.status === "ok" && Boolean(data.knowledge_release));
    $("#apiStatus").textContent = data.knowledge_release ? "검수 지식 준비됨" : "직접 선택 가능";
  } catch { $("#apiStatus").textContent = "서버 확인 필요"; }
}

$$('[data-view]').forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
function setSpendTab(tab) {
  $$('[data-spend-tab]').forEach((item) => { const active = item.dataset.spendTab === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", active); });
  $("#decorShop").classList.toggle("hidden", tab !== "decor");
  $("#outfitShop").classList.toggle("hidden", tab !== "outfit");
  $("#giftShop").classList.toggle("hidden", tab !== "gift");
}
$$('[data-spend-tab]').forEach((b) => b.addEventListener("click", () => setSpendTab(b.dataset.spendTab)));
$$('[data-prev]').forEach((b) => b.addEventListener("click", () => goStep(Number(b.dataset.prev))));
bindImage("areaImage", "areaPreview", "area");
bindImage("afterImage", "afterPreview", "after");
$("#removeArea")?.addEventListener("click", () => { delete state.images.area; $("#areaImage").value = ""; $("#areaPreview").parentElement.classList.remove("has-image"); $("#removeArea").classList.add("hidden"); });
$("#areaImage")?.addEventListener("change", () => $("#removeArea").classList.remove("hidden"));
$("#analyzeArea")?.addEventListener("click", analyzeArea);
$("#confirmArea")?.addEventListener("click", confirmArea);
$("#comparePhotos")?.addEventListener("click", comparePhotos);
$("#startNewMission")?.addEventListener("click", resetMissionForNewArea);
$("#careArea")?.addEventListener("change", renderCareSummary);
$("#finishWithoutPhoto")?.addEventListener("click", () => { saveHistory({ completed: false, awaitingPhotoVerification: true }); toast("사진 없이 기록만 저장했어요. 기억의 조각은 청소 후 사진 확인 뒤에 남아요."); showView("cash"); });
$("#easyToggle").addEventListener("click", () => { const active = !document.body.classList.contains("easy"); document.body.classList.toggle("easy", active); updateZoomButton(active); write(STORE.settings, { easy: active }); });
$("#clearHistory")?.addEventListener("click", () => { if (confirm("저장된 돌봄 기록을 모두 삭제할까요?")) { write(STORE.history, []); renderCash(); renderRoom(); } });
$("#saveWeeklyPlan").addEventListener("click", () => {
  if (state.planAreas.length < 2) return toast("부담 없이 나누려면 돌볼 곳을 2곳 이상 골라주세요.");
  write(STORE.weeklyPlan, createWeeklyPlan(state.planAreas));
  state.planPhoto = null;
  renderWeeklyPlan(); renderDailyMission();
  toast("이번 주에는 하루 한 가지씩만 해볼까요?");
});
$("#resetWeeklyPlan").addEventListener("click", () => {
  const plan = activeWeeklyPlan();
  state.planAreas = plan?.areas || [];
  write(STORE.weeklyPlan, null);
  renderWeeklyPlan();
});
$("#completeDaily").addEventListener("click", () => showView("mission"));
$("#communityForm").addEventListener("submit", submitCommunityPost);
$("#communityCommentForm").addEventListener("submit", submitCommunityComment);
$("#closeCommunityDialog").addEventListener("click", () => $("#communityDialog").close());
$("#refreshCommunity").addEventListener("click", renderCommunity);
$("#openCommunityWrite").addEventListener("click", () => { $("#communityWrite").scrollIntoView({ behavior: "smooth", block: "start" }); $("#communityTitle").focus({ preventScroll: true }); });
$("#accountButton").addEventListener("click", openLogin);
$("#loginForm").addEventListener("submit", submitLogin);
$("#loginDialog").addEventListener("cancel", (event) => { if (!currentAccount()) event.preventDefault(); });

if (currentAccount()) startSignedInApp(); else { renderAccount(); openLogin(); }
setInterval(() => {
  if ($("#room").classList.contains("active")) renderRoom();
}, 1000);
