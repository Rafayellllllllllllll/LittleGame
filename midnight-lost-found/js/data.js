/* 剧情与证据数据。答案全部来自这里的线索，不是猜出来的。 */
const CLUES = {
  tape_2303: { title: "录音 23:03", text: "门铃响后，一个男声说：“我把伞忘在三号柜了。”这个声音，和门口来访者的声音一模一样。", source: "旧录音机 · 第一段" },
  tape_2312: { title: "录音 23:12", text: "一个女声，语气很轻：“钥匙不在抽屉，在旧雨衣的口袋里。”她没有报名字，只叫了一声“小默”。", source: "旧录音机 · 第二段" },
  visitor_claim: { title: "来访者的说法", text: "他说：“我今晚 23:20 才第一次到这里，之前从没来过。”", source: "门口来访者 · 第一次对话" },
  clock_slow: { title: "钟慢了 7 分钟", text: "员工记录本上，沈伯的字：“这钟慢 7 分钟，别信它指的时间。”", source: "员工记录本" },
  clock_stop: { title: "钟停在 23:24", text: "墙上时钟的指针停在 23:24，一动不动。表盘背面刻着一行小字：停表即真相的起点。", source: "墙上时钟" },
  log_2317: { title: "23:17 的空白登记", text: "记录本最后一页：23:17，有人来登记，名字一栏是空的，只写着“找一件没有名字的东西”。", source: "员工记录本" },
  letter_key: { title: "信：钥匙在雨衣里", text: "残信拼好后写着：妈妈把黄铜钥匙缝进了旧雨衣的内袋，小默长大之前，别把这件事告诉他。", source: "残缺信件" },
  letter_mother: { title: "信的口吻", text: "信的语气是一个母亲在交代后事，落款被撕掉了，只剩一个“棠”字。", source: "残缺信件" },
  photo_family: { title: "旧照片：一家人", text: "照片里有三个人：老店员沈伯、一个年轻女人、一个小男孩，站在招领处门口。", source: "墙上时钟暗格里的照片" },
  photo_back: { title: "照片背面", text: "背面写着：“一家人，2016 年冬。默，别弄丢。”", source: "旧照片背面" },
  raincoat_stitch: { title: "雨衣内袋的针脚", text: "把雨衣翻过来、转一圈再看：内袋有一圈新针脚，里面摸得到一个硬硬的小东西。", source: "旧雨衣 · 翻面旋转后" },
  cabinet_3: { title: "三号柜里是雨衣", text: "三号柜里没有伞，只有一件旧雨衣，袖口磨得很厉害，像是很多年前穿过的。", source: "三号柜" },
  scissors: { title: "抽屉里的剪刀", text: "上锁的抽屉打开后，里面有剪刀、针线和几张残信碎片。剪刀是用来拆针脚的，不是用来伤人的。", source: "上锁的抽屉" },
  ticket: { title: "旧车票（隐藏）", text: "柜台暗格里一张 2016 年冬天的车票，目的地是沈伯老家，名字栏写着“沈默”。这是全游戏唯一的、直接写着他全名的地方。", source: "柜台暗格 · 隐藏物品" }
};

const ITEMS = {
  tape: { name: "录音带", desc: "旧录音机里的带子，两段录音，时间对不上来访者的说法。" },
  logbook: { name: "记录本残页", desc: "沈伯的字迹：钟慢 7 分钟；23:17 有人登记，名字空白。" },
  raincoat: { name: "旧雨衣", desc: "三号柜里的旧雨衣。翻过来、转一转，内袋有新针脚。" },
  scissors: { name: "剪刀", desc: "抽屉里的剪刀，可以拆开缝死的内袋。" },
  letter: { name: "残信碎片", desc: "四张碎片，拼好才能读出妈妈留的话。" },
  photo: { name: "旧照片", desc: "2016 年冬的一家人。背面写着“默，别弄丢”。" },
  umbrella: { name: "黑伞", desc: "来访者留在门口的伞。伞不是他真正丢的东西，别被它带偏。" },
  brassKey: { name: "黄铜钥匙", desc: "从雨衣内袋里拆出来的钥匙。妈妈留下的，也是他真正丢的东西。" }
};

const ACHIEVEMENTS = {
  first_step: "初到招领处", timeline: "时间侦探", clockmaker: "钟表匠",
  stitch: "针脚里的秘密", letter: "拼信人", family: "一家人",
  testimony: "证词猎手", handy: "巧手拆线", truth: "说出名字的人",
  hidden_ticket: "暗格里的车票", full_clues: "线索全收集", no_hint: "零提示通关"
};

const VALID_LINKS = [
  ["tape_2303", "visitor_claim"], ["letter_key", "raincoat_stitch"],
  ["photo_back", "letter_mother"], ["clock_slow", "clock_stop"]
];
const LINK_NAMES = {
  "tape_2303|visitor_claim": "录音 23:03 戳破了“23:20 才第一次来”的说法",
  "letter_key|raincoat_stitch": "信说的内袋，和雨衣上的新针脚对上了",
  "photo_back|letter_mother": "照片背面的“默”和信里的妈妈，是同一个人家",
  "clock_slow|clock_stop": "钟面 23:24，加上慢的 7 分钟，真实停表时间是 23:31"
};
function linkKey(a, b) { return [a, b].sort().join("|"); }

const PUZZLES = [
  { id: "p1", title: "谜题 1 · 录音与时间线", type: "choice", requires: "recorder",
    story: "来访者说自己 23:20 才第一次来。录音带里有两段话，哪一段直接和他的说法对不上？",
    options: ["23:03 的男声：我把伞忘在三号柜了", "23:12 的女声：钥匙在旧雨衣口袋里", "两段都没有问题", "录音带根本没有时间"],
    answer: 0, achievement: "timeline",
    hints: ["先看录音的时间，再看他说的到达时间。", "23:03 已经有人在门口说话了，那个人的声音你认得吗？", "答案就是 23:03 那段：他在 23:20 之前就已经来过。"],
    fail: "再对一下时间：他说 23:20 才第一次来，可有一段录音比这更早，而且声音就是他。",
    success: "对上了。23:03 他就已经在门口了，“第一次来”是假话——但假话背后，可能是不敢承认。" },
  { id: "p2", title: "谜题 2 · 墙上时钟机关", type: "clock", requires: "clock",
    story: "钟停在 23:24，记录本说这钟慢 7 分钟。把指针拨到真实的停表时间，暗格才会弹开。",
    answer: { h: 23, m: 31 }, achievement: "clockmaker",
    hints: ["钟面时间不是真实时间，记录本里有修正值。", "23:24 加上慢掉的 7 分钟，是几点？", "拨到 23:31，暗格里的照片会告诉你更多。"],
    fail: "指针还没对。提醒：钟面是 23:24，它慢 7 分钟，真实时间要往后加。",
    success: "咔哒一声，暗格弹开了。里面是一张旧照片：一家人，2016 年冬。" },
  { id: "p3", title: "谜题 3 · 雨衣的隐藏文字", type: "rotate", requires: "cabinet",
    story: "旧雨衣正面看不出什么。试着翻面、旋转：只有在背面、转了半圈的时候，内袋的针脚和字迹才会同时露出来。",
    answer: { side: "back", rot: 180 }, achievement: "stitch",
    hints: ["正面没有线索，换一面看看。", "翻到背面后，再转一转角度。", "背面 + 转 180 度，内袋针脚和“给小默”会一起出现。"],
    fail: "这个角度还看不到。记住两个条件：背面，而且转了半圈。",
    success: "内袋针脚露出来了，里面摸得到一个硬硬的小东西，旁边绣着：给小默。" },
  { id: "p4", title: "谜题 4 · 残缺信件拼接", type: "order", requires: "drawer",
    story: "抽屉里有四张碎片。按语义排好顺序，读出妈妈留下的完整一句话。",
    fragments: ["小默长大之前，", "别把这件事告诉他。", "妈妈把黄铜钥匙", "缝进了旧雨衣的内袋，"],
    answer: [2, 3, 0, 1], achievement: "letter",
    hints: ["先找主语：谁把什么东西放进了哪里？", "“妈妈把黄铜钥匙”开头，后面接“缝进了……”", "顺序是：妈妈把黄铜钥匙 / 缝进了旧雨衣的内袋 / 小默长大之前 / 别把这件事告诉他。"],
    fail: "句子读不通。先找主语和动作：妈妈、钥匙、缝进雨衣，剩下的两句是时间和叮嘱。",
    success: "信拼好了。妈妈把钥匙缝进雨衣，是想等孩子长大再给他——可孩子长大后，却把这件事连同名字一起弄丢了。" },
  { id: "p5", title: "谜题 5 · 照片人物关系", type: "match", requires: "photo",
    story: "照片里有三个人。请按线索给每个人对上身份：老人、年轻女人、小男孩分别是谁？",
    faces: ["照片里的老人", "照片里的年轻女人", "照片里的小男孩"],
    options: ["沈伯（老店员）", "阿棠（妈妈）", "小默（长大后的来访者）", "不认识的路人"],
    answer: [0, 1, 2], achievement: "family",
    hints: ["老人是招领处的老店员，记录本就是他的字。", "信的落款剩一个“棠”字，年轻女人就是写信的人。", "小男孩就是长大后站在门口的人：照片背面写着“默”。"],
    fail: "再想想：记录本的字是谁的？信是谁写的？照片背面那个“默”又是谁？",
    success: "对上了。老人是沈伯，女人是妈妈阿棠，小男孩就是现在的来访者——沈默。" },
  { id: "p6", title: "谜题 6 · 证词矛盾识别", type: "pair", requires: "visitor",
    story: "来访者说过三句话。选出一句假话，再选出能直接反驳它的证据。",
    claims: ["我从没来过这里", "我丢的是一把伞", "我不认识沈伯"],
    evidences: ["录音带 23:03", "旧照片", "残信"],
    answer: { claim: 0, evidence: 0 }, altEvidence: 1, achievement: "testimony",
    hints: ["哪句话和录音、照片都对不上？", "“从没来过”最容易被戳破：23:03 的录音里就有他。", "假话是“我从没来过这里”，反驳它用录音带最直接，旧照片也可以。"],
    fail: "这组搭配还不够直接。想一想：哪句话是“来没来过”的问题，哪条证据记录了他在场？",
    success: "矛盾找出来了。他来过，只是假装没来过。接下来的问题是：他为什么不敢承认自己来过？" },
  { id: "p7", title: "谜题 7 · 多道具组合", type: "combine", requires: "both",
    story: "钥匙缝在雨衣内袋里，针脚很结实。背包里选两件道具，把它取出来。",
    answer: ["raincoat", "scissors"], achievement: "handy",
    hints: ["要拆开缝死的内袋，需要一件工具。", "雨衣 + 一件能剪开针脚的东西。", "组合：旧雨衣 + 剪刀，钥匙就在内袋里。"],
    fail: "这两件合不到一起。钥匙在雨衣内袋里，针脚缝死了——你需要先拆线。",
    success: "针脚拆开了。黄铜钥匙掉在掌心，温温的，像是被人握了很多年。" },
  { id: "p8", title: "谜题 8 · 最终综合推理", type: "final", requires: "all7",
    story: "把所有线索连起来，回答三个问题。答错可以重来，不会卡死，但每道题都要有证据支撑。",
    questions: [
      { q: "来访者到底是谁？", options: ["沈伯失联多年的儿子沈默", "路过的旅客", "沈伯的同事", "来取伞的邻居"], answer: 0 },
      { q: "他真正丢的是什么？", options: ["一把黑伞", "妈妈留下的黄铜钥匙", "一张车票", "员工记录本"], answer: 1 },
      { q: "钥匙原来藏在哪里？", options: ["上锁的抽屉里", "旧雨衣的内袋里", "三号柜的伞架上", "来访者的口袋里"], answer: 1 }
    ],
    hints: ["照片背面、信、录音，三条线指向同一个人。", "伞只是他随口说的，信里说的才是真的失物。", "答案：沈默 / 黄铜钥匙 / 旧雨衣的内袋。"],
    fail: "有一道题和证据对不上。回线索档案翻一翻：照片背面、残信、录音 23:03。",
    success: "全对。真相完整了：沈默丢的不是伞，是妈妈缝进雨衣里的钥匙。他不敢写名字，是怕认了名字，就得承认妈妈已经不在了。" }
];

const DIALOGUE = {
  intro: { speaker: "来访者", text: "雨下得真大……不好意思，我丢了一样东西。可是登记表上，我……我写不出它的名字。",
    options: [
      { text: "先坐下，慢慢说，不着急写名字。", trust: 5, next: "ask_lost" },
      { text: "你今晚是第一次来吗？", trust: 0, next: "ask_first" },
      { text: "你是不是在撒谎？录音里 23:03 就有你。", trust: -5, next: "pressed", requiresClue: "tape_2303" }
    ] },
  ask_lost: { speaker: "来访者", text: "我……我记得是一件很小的东西，黄黄的，握在手里有点沉。别的，我真的想不起来了。",
    options: [
      { text: "黄黄的、沉沉的……像一把钥匙吗？", trust: 5, next: "ask_past" },
      { text: "出示证据", trust: 0, next: "present" },
      { text: "那把门口的黑伞，是你的吗？", trust: -5, next: "umbrella_trap" }
    ] },
  ask_first: { speaker: "来访者", text: "……是，第一次来。我以前没进过这间屋子。",
    options: [
      { text: "我相信你说的话，但录音可能记得不一样。", trust: 5, next: "present" },
      { text: "好，我先不追问。你还记得丢的东西长什么样吗？", trust: 5, next: "ask_lost" }
    ] },
  pressed: { speaker: "来访者", text: "……你都知道了？对，我来过。可我要是承认来过，就得承认……我把她留下的东西弄丢了。",
    options: [
      { text: "弄丢东西不是你的错。我们一起把它找回来。", trust: 10, next: "ask_past" },
      { text: "出示证据", trust: 0, next: "present" }
    ] },
  umbrella_trap: { speaker: "来访者", text: "伞……伞是我随手拿的借口。我真正丢的不是伞，别再问伞了。",
    options: [{ text: "好，不问伞了。说说你真正记得的东西。", trust: 5, next: "ask_lost" }] },
  ask_past: { speaker: "来访者", text: "我小时候常来这里。柜台后面有个老爷爷，字写得很好看。后来……我就不敢来了。",
    options: [
      { text: "那个老爷爷是沈伯。你小时候的照片，还在这里。", trust: 10, next: "present", requiresClue: "photo_family" },
      { text: "出示证据", trust: 0, next: "present" },
      { text: "你不敢来，是因为怕想起什么人吗？", trust: 5, next: "ask_mother" }
    ] },
  ask_mother: { speaker: "来访者", text: "……她走之前，缝了一件东西进雨衣里。让我长大再拿。可我长大了，却连她的样子都快记不清了。",
    options: [
      { text: "出示那封信，让他自己读完剩下的话。", trust: 15, next: "letter_shown", requiresClue: "letter_key" },
      { text: "出示证据", trust: 0, next: "present" }
    ] },
  letter_shown: { speaker: "来访者", text: "……“小默长大之前，别把这件事告诉他。”原来妈妈早就知道，我会忘。她不是怪我，她是怕我难过。",
    options: [{ text: "所以你的名字不是没有，是你一直没敢认。", trust: 10, next: "present", flag: "letterShown" }] },
  present: { speaker: "招领处店员（你）", text: "你要出示哪条证据？选错证据会让他更防备，选对了，他会多信任你一点。",
    options: "present" },
  done: { speaker: "来访者", text: "谢谢你陪我把这些拼起来。等钥匙找到了，我想……我再决定要不要写下名字。",
    options: [{ text: "去解最终推理（谜题 8），然后回来做最后的选择。", trust: 0, next: "done" }] }
};
