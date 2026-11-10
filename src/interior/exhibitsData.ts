/**
 * 展品資料（全部為真實存在的作品）。
 * 位置依 stpetersbasilica.info 官方平面圖的參觀順序近似擺放；
 * 解說只寫多個來源一致的事實，來源互相矛盾處以「一說」標註或不寫。
 * 座標為大教堂本地座標：原點穹頂中心、+X 朝入口（東）、z<0 為北（入內後的右側）、地坪 y = 0。
 */
export type Zone = 'portico' | 'nave' | 'saisle' | 'crossing' | 'stransept' | 'swchapel' | 'apse' | 'nwchapel' | 'ntransept' | 'naisle';

export const ZONES: { id: Zone; name: string }[] = [
  { id: 'portico', name: '柱廊（前廊）' },
  { id: 'nave', name: '入口與中殿' },
  { id: 'saisle', name: '左側廊' },
  { id: 'crossing', name: '穹頂與交叉部' },
  { id: 'stransept', name: '左耳堂' },
  { id: 'swchapel', name: '圓柱聖母禮拜堂一帶' },
  { id: 'apse', name: '後殿' },
  { id: 'nwchapel', name: '聖彌額爾禮拜堂一帶' },
  { id: 'ntransept', name: '右耳堂' },
  { id: 'naisle', name: '中殿右側與右側廊' },
];

export interface Exhibit {
  id: string;
  zone: Zone;
  title: string;
  subtitle: string; // 作者 · 年代 · 材質
  text: string;
  station: [number, number, number]; // 觀看位置（眼高）
  look: [number, number, number]; // 注視點
  hotspot: [number, number, number]; // 資訊點
  fov?: number;
  featured?: boolean; // 精選路線
  sources: string[];
  modelUrl?: string; // 預留：之後替換為真實 3D 掃描（glTF）
  /** 經查證出處與授權的真實 3D 掃描（僅作補充檢視，不取代場景中的全尺寸造型） */
  scan?: { url: string; title: string; credit: string; license: string; source: string };
  /** 場景中使用的真實影像（credits.ts 的鍵） */
  art?: string[];
  /** 祭壇畫找不到可用影像（以深色畫板表示）時的說明 */
  noImage?: string;
}

const SP = 'https://www.stpetersbasilica.info';
const WK = 'https://en.wikipedia.org/wiki/';

export const EXHIBITS: Exhibit[] = [
  // ── 柱廊 ──
  {
    id: 'charlemagne', zone: 'portico', title: '查理曼騎馬像', subtitle: 'Agostino Cornacchini · 1725 年',
    text: '位於柱廊最南端（從外面看是左端），與另一端的君士坦丁像遙遙相對。查理曼是第一位在聖彼得大教堂加冕的皇帝：西元 800 年聖誕，由教宗良三世加冕。',
    station: [125, 1.7, 25], look: [125, 4.2, 41], hotspot: [127, 8.5, 38], fov: 55,
    sources: [`${SP}/Statues/Charlemagne/Charlemagne.htm`],
  },
  {
    id: 'navicella', zone: 'portico', title: '《小船》馬賽克 Navicella', subtitle: '傳為喬托 · 約 1298 年 · 馬賽克（經大幅修復）',
    text: '描繪耶穌在水面行走、向船上門徒伸手的場景。原本是 Stefaneschi 樞機在 1298 年為舊聖彼得大教堂訂製的作品，後來移到柱廊，位於中央入口上方的弦月面，經過多次修復，今天所見大多是後世重做的部分。',
    station: [120.5, 1.7, 0], look: [131, 10.8, 0], hotspot: [130, 13.4, 2.4], fov: 55, featured: true,
    sources: [`${SP}/Interior/Navicella/Navicella.htm`],
    art: ['navicella'],
  },
  {
    id: 'constantine', zone: 'portico', title: '君士坦丁騎馬像', subtitle: '貝尼尼 · 1654 年受託，1670 年完成',
    text: '位於柱廊最北端，在通往梵蒂岡宮的「國王階梯」（Scala Regia）腳下。表現君士坦丁大帝看見天上十字架異象的一刻，戰馬高高揚起；身後是灰泥做的大幅帷幔。1654 年由依諾增爵十世委託，1670 年在克勉十世任內揭幕。',
    station: [125, 1.7, -25], look: [125, 4.2, -41], hotspot: [127, 8.5, -38], fov: 55,
    sources: [`${SP}/Statues/Constantine/Constantine.htm`],
  },
  {
    id: 'filarete', zone: 'portico', title: '菲拉雷特銅門（中央大門）', subtitle: 'Antonio Averlino「菲拉雷特」 · 1445 年完成（一說 1455 年） · 青銅',
    text: '五扇大門中最古老的一扇，是教宗恩仁四世為舊聖彼得大教堂訂製的作品，新教堂落成後沿用為中央大門。門扇內側下方有菲拉雷特與助手們的自畫像。',
    station: [128.5, 1.7, 0.6], look: [118, 5, 0], hotspot: [120, 11.4, 3.6], fov: 58, featured: true,
    sources: [`${SP}/Interior/DoorFilarete/DoorFilarete.htm`],
    art: ['filarete'],
  },
  // ── 入口與中殿 ──
  {
    id: 'holydoor', zone: 'portico', title: '聖門 Porta Santa', subtitle: 'Vico Consorti · 1949 年（一說 1950 年） · 青銅',
    text: '在柱廊上，五扇大門最北側的一扇，平時封閉，只在禧年開啟。Consorti 的青銅門扇分為四層共 16 格浮雕，1949 年 12 月 24 日起取代 1749 年的舊木門。最近一次是 2025 年禧年：2024 年 12 月 24 日開啟，2026 年 1 月 6 日關閉。',
    station: [127, 1.7, -20.5], look: [119, 4.2, -25], hotspot: [120, 9.6, -22.6], fov: 55, featured: true,
    sources: [`${SP}/Interior/HolyDoor/HolyDoor.htm`, `${WK}Holy_door`],
  },
  {
    id: 'rota', zone: 'nave', title: '斑岩圓盤 Rota Porfiretica', subtitle: '紅斑岩 · 取自舊聖彼得大教堂',
    text: '中央大門內的深紅色斑岩圓盤，從舊大教堂移來。依傳統，西元 800 年聖誕，查理曼就是跪在這塊圓盤上由教宗良三世加冕為皇帝。',
    station: [106.5, 1.7, 4.5], look: [111.5, 0, 0], hotspot: [111.5, 1.2, 0], fov: 60, featured: true,
    sources: [`${SP}/Interior/Nave/Nave.htm`],
  },
  {
    id: 'nave', zone: 'nave', title: '中殿', subtitle: '卡洛·馬德諾 · 1607 年動工 · 內部長 186.3 m · 拱頂高 45.5 m',
    text: '馬德諾把米開朗基羅的希臘十字平面向東延伸成拉丁十字，使大教堂內部長達 186.3 m。鍍金藻井的筒形拱頂高 45.5 m。中殿地面嵌有黃銅字，標出世界各大教堂的長度，可以和聖彼得大教堂比較。',
    station: [84, 1.7, 0], look: [0, 30, 0], hotspot: [84, 3, 6], fov: 70, featured: true,
    sources: [`${SP}/Interior/Nave/Nave.htm`],
  },
  {
    id: 'stoups', zone: 'nave', title: '聖水盆與小天使', subtitle: '1722–1725 年 · 大理石',
    text: '中殿第一拱下兩側各有一座聖水盆，由兩位小天使捧著黃色大理石貝殼形水盆。天使看似孩童，其實高約 2 m，走近才感受到教堂的真實尺度。製作者有 Francesco Moderati、Giuseppe Lironi 等人，各來源的分工說法不一。',
    station: [97, 1.7, -5], look: [103, 1.6, -13], hotspot: [104.2, 3.4, -12.4], fov: 55,
    sources: [`${SP}/Interior/Nave/Nave.htm`],
  },
  {
    id: 'founders_s', zone: 'nave', title: '創辦人像：中殿左側', subtitle: '8 尊 · 修會創辦聖人像',
    text: '中殿左側（南）柱面上下兩層壁龕中的修會創辦人像：Lucy Filippini（Silvio Silva，1949）、亞爾剛大拉的伯多祿 Peter of Alcantara（Francesco Vergara，1713）、Louis Grignion de Montfort（Giacomo Parisini，1948）、嘉民 Camillus de Lellis（Pietro Pacilli，1753）、Anthony Mary Zaccaria（Cesare Aureli，1909）、依納爵·羅耀拉 Ignatius Loyola（Camillo 與 Giuseppe Rusconi，1733）、保拉的方濟各 Francis of Paola（G. B. Maini，1732）、Peter Fourier（Louis Noël Nicoli，1899）。（官方位置圖只標出分區，同區內各尊對應的壁龕此處不逐一標示。）',
    station: [54, 1.7, -4], look: [61, 10, 13.7], hotspot: [63.5, 12, 12.5], fov: 62,
    sources: [`${SP}/Statues/Founders/FounderSaints.htm`],
  },
  {
    id: 'founders_n', zone: 'nave', title: '創辦人像：中殿右側', subtitle: '7 尊 · 修會創辦聖人像',
    text: '中殿右側（北）柱面壁龕中的修會創辦人像；最靠穹頂的下層位置是聖彼得青銅像，鮑思高像就在它上方。名單：鮑思高 John Bosco（Pietro Canonica，1936）、喇沙 John Baptist de la Salle（Cesare Aureli，1904）、斐理伯·內利 Philip Neri（G. B. Maini，1737）、味增爵 Vincent de Paul（Pietro Bracci，1754）、John Eudes（Silvio Silva，1932）、Madeleine Sophie Barat（Enrico Quattrini，1934）、大德蘭 Teresa of Jesus（Filippo Della Valle，1754）。（官方位置圖只標出分區，同區內各尊對應的壁龕此處不逐一標示。）',
    station: [54, 1.7, 4], look: [61, 10, -13.7], hotspot: [63.5, 12, -12.5], fov: 62,
    sources: [`${SP}/Statues/Founders/FounderSaints.htm`],
  },
  // ── 左側廊 ──
  {
    id: 'baptistery', zone: 'saisle', title: '洗禮堂', subtitle: 'Carlo Fontana 設計 · 洗禮池蓋 1698 年完成',
    text: '左側廊第一座禮拜堂。洗禮池是一整塊古代紅斑岩，曾作為皇帝奧托二世石棺的棺蓋；上方的鍍金青銅池蓋依 Fontana 的設計製作。祭壇畫是依 Carlo Maratta 原作製成的馬賽克《基督受洗》。',
    station: [110, 1.7, 20], look: [110, 2.6, 31], hotspot: [107.6, 4.4, 29], fov: 58,
    sources: [`${SP}/Altars/Baptistery/Baptistery.htm`],
    art: ['baptism'],
  },
  {
    id: 'stuarts', zone: 'saisle', title: '斯圖亞特王族紀念碑', subtitle: '安東尼奧·卡諾瓦 · 大理石',
    text: '紀念流亡羅馬的英國斯圖亞特王室最後三位成員：詹姆斯（老僭王）與其子查理·愛德華、亨利。白色大理石碑上刻三人的側面肖像，下方兩位哀悼的天使守在墓門兩旁。各來源記載的完成年份不一。',
    station: [103, 1.7, 26.5], look: [103, 4.2, 17], hotspot: [105, 7.5, 18], fov: 55,
    sources: [`${SP}/Monuments/Stuarts/Stuarts.htm`],
  },
  {
    id: 'innocent8', zone: 'saisle', title: '依諾增爵八世紀念碑', subtitle: 'Antonio 與 Piero del Pollaiolo · 1498 年 · 青銅',
    text: '這是唯一從舊聖彼得大教堂遷來的教宗紀念碑，最早位於舊大教堂的凱旋拱，1621 年才放到今天的位置。紀念碑上有坐姿與臥姿兩尊教宗像，坐姿教宗左手持聖矛的尖頭，紀念他在位時接收這件聖髑。',
    station: [89, 1.7, 26.5], look: [89, 4.8, 17], hotspot: [91, 8, 18], fov: 55,
    sources: [`${SP}/Monuments/InnocentVIII/InnocentVIII.htm`],
  },
  {
    id: 'transfiguration', zone: 'saisle', title: '主顯聖容祭台', subtitle: '拉斐爾原作的馬賽克複製 · 1767 年完成',
    text: '位於聖安德烈巨柱外側，左側廊的盡頭。《主顯聖容》是拉斐爾的最後一幅畫，他在 1520 年去世時尚未完成，由學生補完，原作今藏梵蒂岡美術館。這裡是 18 世紀依原作製成的馬賽克；大教堂各祭台的「畫」大多是這類馬賽克複製品。',
    station: [44, 1.7, 25], look: [33, 5.5, 25], hotspot: [34, 9.5, 28], fov: 55,
    sources: [`${SP}/Altars/Transfiguration/Transfiguration.htm`],
    art: ['transfiguration'],
  },
  {
    id: 'clementine', zone: 'saisle', title: '克勉禮拜堂與聖額我略一世祭台', subtitle: '為 1600 年禧年建造 · 穹頂馬賽克 Roncalli 設計（1603）',
    text: '大教堂四座轉角禮拜堂之一，由教宗克勉八世為 1600 年禧年完成。祭台下的白色大理石石棺安放教宗聖額我略一世（大額我略）的遺骸，1606 年遷入。祭壇畫是依 Andrea Sacchi 原作製成的馬賽克《聖額我略的奇蹟》。禮拜堂內另有丹麥雕塑家 Thorvaldsen 的庇護七世紀念碑（1831）。',
    station: [40, 1.7, 21], look: [40, 9, 33], hotspot: [42.5, 11, 31.5], fov: 66,
    sources: [`${SP}/Altars/Clementine/Clementine.htm`, `${SP}/Altars/GregoryGreat/GregoryGreat.htm`],
    art: ['gregory'],
  },
  // ── 穹頂與交叉部 ──
  {
    id: 'confessio', zone: 'crossing', title: '告解堂 Confessio', subtitle: '卡洛·馬德諾 · 1615–1617',
    text: '教宗祭台前方下沉的半圓形空間，正對祭台下方傳統認定的聖彼得墓。四周的大理石欄杆上排列著 46 盞豐饒角形的油燈。',
    station: [19.5, 1.7, 3.5], look: [9.5, -2.2, 0], hotspot: [13.8, 1.8, 4.6], fov: 55,
    sources: [`${SP}/Confessio/Confessio.htm`],
  },
  {
    id: 'baldacchino', zone: 'crossing', title: '貝尼尼華蓋 Baldacchino', subtitle: '貝尼尼 · 1624–1633（一說 1623–1634） · 青銅 · 高約 29 m',
    text: '覆蓋在教宗祭台上方的巨大青銅華蓋，由四根高約 20 m 的所羅門式螺旋柱撐起，柱身纏繞月桂枝葉，並飾有委託人烏爾巴諾八世家族（Barberini）的蜜蜂紋章。華蓋內頂是金色光芒中的聖靈之鴿。1633 年聖伯多祿節揭幕。祭台正下方是傳統認定的聖彼得墓。',
    station: [24, 1.7, 9], look: [0, 15, 0], hotspot: [6.5, 10, 6.5], fov: 62, featured: true,
    sources: [`${SP}/Altars/PapalAltar/PapalAltar.htm`, `${WK}St._Peter%27s_Baldachin`],
  },
  {
    id: 'dome', zone: 'crossing', title: '米開朗基羅穹頂（內部）', subtitle: '米開朗基羅設計 · 德拉·波爾塔 1590 年完成 · 內徑 41.5 m',
    text: '從地面到燈籠亭內頂 117.57 m。鼓座 16 扇窗灑下天光，穹頂內面由 16 道肋分成 16 瓣，滿布馬賽克。環繞穹頂下緣的拉丁文銘文出自馬太福音 16:18–19：「你是彼得，我要把我的教會建在這磐石上……我要把天國的鑰匙給你」。字母高約 1.4 m（另有記載 2 m）。',
    station: [12, 1.7, -13], look: [0, 95, 0], hotspot: [0, 50, -19], fov: 78, featured: true,
    sources: [`${SP}/Interior/Dome/Dome.htm`, `${SP}/Interior/Nave/Nave.htm`],
  },
  {
    id: 'piers', zone: 'crossing', title: '四柱巨像', subtitle: '貝尼尼、Bolgi、Mochi、Duquesnoy · 1630 年代 · 大理石',
    text: '支撐穹頂的四根巨柱，壁龕中各有一尊約 5 m 高的聖人像（聖安德烈像 4.68 m），分別對應大教堂保存的聖髑：手持聖矛的聖朗基努斯（貝尼尼）、扶著十字架的聖海倫娜（Andrea Bolgi）、展開聖帕的聖維羅妮卡（Francesco Mochi）、倚著 X 形十字架的聖安德烈（François Duquesnoy）。上方陽台是存放聖髑之處。1506 年 4 月 18 日，教宗儒略二世在聖維羅妮卡柱下安放了新教堂的奠基石。',
    station: [23, 1.7, 1], look: [17.9, 7.5, -17.9], hotspot: [16, 12.5, -16], fov: 58, featured: true,
    sources: [`${SP}/Statues/StLonginus/StLonginus.htm`, `${SP}/Statues/StHelen/StHelen.htm`, `${SP}/Statues/StVeronica/StVeronica.htm`, `${SP}/Statues/StAndrew/StAndrew.htm`],
  },
  {
    id: 'founders_w', zone: 'crossing', title: '創辦人像：兩耳堂西側', subtitle: '8 尊 · 修會創辦聖人像',
    text: '左右兩耳堂西側柱面上下兩層壁龕中的修會創辦人像：William（Giuseppe Prinzi，1878）、諾伯 Norbert（Pietro Bracci，1767）、安琪·梅利奇 Angela Merici（Pietro Galli，1866）、Juliana Falconieri（Paolo Campi，1740）、Paul of the Cross（Ignazio Iacometti，1876）、布魯諾 Bruno（Michelangelo Slodtz，1744）、Bonfilius Monaldi（Cesare Aureli，1906）、Joseph Calasanctius（Innocenzo Spinazzi，1755）。（官方位置圖只標出分區，同區內各尊對應的壁龕此處不逐一標示。）',
    station: [1.5, 1.7, -30], look: [-13.7, 10, -28], hotspot: [-12.5, 12.5, -25], fov: 62,
    sources: [`${SP}/Statues/Founders/FounderSaints.htm`],
  },
  {
    id: 'founders_e', zone: 'crossing', title: '創辦人像：兩耳堂東側', subtitle: '8 尊 · 修會創辦聖人像',
    text: '左右兩耳堂東側柱面上下兩層壁龕中的修會創辦人像：Joan Antida Thouret（Enrico 與 Carlo Quattrini，1949）、Jerome Emiliani（Pietro Bracci，1757）、Frances Cabrini（Enrico Tadolini，1947）、Cajetan Thiene（Carlo Monaldi，1738）、Mary Euphrasia Pelletier（Giovanni Nicolini，1942）、天主的若望 John of God（Filippo Della Valle，1745）、Louise de Marillac（Antonio Berti，1954）、Peter Nolasco（Paolo Campi，1742）。（官方位置圖只標出分區，同區內各尊對應的壁龕此處不逐一標示。）',
    station: [-1.5, 1.7, 30], look: [13.7, 10, 28], hotspot: [12.5, 12.5, 25], fov: 62,
    sources: [`${SP}/Statues/Founders/FounderSaints.htm`],
  },
  // ── 左耳堂 ──
  {
    id: 'stransaltars', zone: 'stransept', title: '左耳堂三祭台', subtitle: '聖若瑟 · 聖多默 · 聖伯多祿倒釘十字架',
    text: '中央是聖若瑟祭台：Achille Funi 1961 年的原畫於 1963 年製成馬賽克，同年 3 月 19 日由若望二十三世祝福；祭台下的古代石棺安放聖西滿與聖猶達·達陡的聖髑。右側是聖多默祭台，馬賽克依 Vincenzo Camuccini 的原畫描繪「多默的疑惑」，祭台下有教宗聖鮑尼法斯四世的聖髑。左側是聖伯多祿倒釘十字架祭台，馬賽克依 Guido Reni 的原畫製作，原畫今藏梵蒂岡美術館。',
    station: [0, 1.7, 45], look: [0, 6, 68], hotspot: [2.5, 11.5, 66.5], fov: 62,
    sources: [`${SP}/Altars/StJoseph/StJoseph.htm`, `${SP}/Altars/StThomas/StThomas.htm`, `${SP}/Altars/CrucifixionStPeter/CrucifixionStPeter.htm`],
    noImage: '聖多默祭台',
    art: ['joseph', 'crucifixion'],
  },
  {
    id: 'alexander', zone: 'stransept', title: '亞歷山大七世紀念碑', subtitle: '貝尼尼 · 1671–1678 · 大理石、西西里碧玉、鍍金青銅',
    text: '貝尼尼晚年的作品，位於左（南）耳堂的外側牆，包住了一扇通往大教堂出口的門。教宗跪在高處祈禱，四周是慈愛、真理、審慎、正義四位寓意人物；下方一具鍍金青銅骷髏從紅色碧玉帷幔中探出，高舉沙漏，提醒世人生命短暫。',
    station: [4, 1.7, 40], look: [-13.7, 6.5, 40], hotspot: [-12.3, 10.5, 36.8], fov: 55, featured: true,
    sources: [`${SP}/Monuments/AlexanderVII/AlexanderVII.htm`, `${WK}Tomb_of_Pope_Alexander_VII`],
  },
  // ── 圓柱聖母禮拜堂一帶（西南轉角） ──
  {
    id: 'sacredheart', zone: 'swchapel', title: '耶穌聖心祭台', subtitle: 'Carlo Muccioli 原畫 · 1920–1925 年製成馬賽克',
    text: '位於聖維羅妮卡巨柱南側。描繪耶穌聖心向聖瑪加利大·亞拉高顯現。原畫由 Carlo Muccioli 於 1919–20 年繪製，1920–25 年製成馬賽克，取代了此處原本 Francesco Vanni 的《術士西滿墮落》；1923 年重新祝聖。',
    station: [-37.5, 1.7, 43], look: [-37.5, 5, 33], hotspot: [-35, 9.5, 34], fov: 58,
    sources: [`${SP}/Altars/SacredHeart/SacredHeart.htm`],
    art: ['sacredheart'],
  },
  {
    id: 'cripple', zone: 'swchapel', title: '聖伯多祿治癒癱子祭台', subtitle: 'Francesco Mancini 原畫（1748） · 1751–1758 年製成馬賽克',
    text: '描繪宗徒大事錄第 3 章：伯多祿在聖殿門口治好生來瘸腿的人。原畫為 Francesco Mancini 1748 年所作，馬賽克於 1751–58 年完成。此處最早的祭壇畫是 Cigoli 1604–06 年的作品，今已失傳。',
    station: [-40, 1.7, 48], look: [-43.5, 5, 56], hotspot: [-41, 9.5, 55], fov: 58,
    sources: [`${SP}/Altars/StPeter-Cripple/StPeter-Cripple.htm`],
    noImage: '治癒癱子祭台',
  },
  {
    id: 'column', zone: 'swchapel', title: '圓柱聖母禮拜堂與祭台', subtitle: '禮拜堂：Giacomo della Porta 設計 · 聖像 1607 年安置',
    text: '大教堂後殿一側的轉角禮拜堂，又稱聖良禮拜堂，小穹頂內飾有聖母德敘禱文的圖樣。祭台上的聖母像畫在舊聖彼得大教堂中殿的一根大理石柱上，1607 年保祿五世時安置於此，1645 年加冕；1964 年保祿六世以「教會之母」稱號尊崇她。祭台下的 4 世紀石棺中安放教宗良二世、良三世、良四世的遺骸。',
    station: [-44, 1.7, 40], look: [-33, 5, 40], hotspot: [-34, 9.5, 42.5], fov: 60, featured: true,
    sources: [`${SP}/Altars/ColumnChapel/ColumnChapel.htm`, `${SP}/Altars/OurLadyColumn/OurLadyColumn.htm`],
    noImage: '圓柱聖母像',
  },
  {
    id: 'leo', zone: 'swchapel', title: '聖良一世祭台', subtitle: 'Alessandro Algardi · 1646–1653 · 大理石高浮雕',
    text: '位於圓柱聖母禮拜堂右側，兩旁是黑色花崗岩柱。祭壇是一整面大理石高浮雕，刻畫教宗良一世與匈人王阿提拉會面、勸退其進攻羅馬。這是大教堂中唯一以大型大理石浮雕作為祭壇畫的祭台。',
    station: [-45, 1.7, 48], look: [-54, 5, 44.5], hotspot: [-53, 9, 47], fov: 55,
    sources: [`${SP}/Altars/LeotheGreat/LeotheGreat.htm`],
    art: ['leo'],
  },
  {
    id: 'alexander8', zone: 'swchapel', title: '亞歷山大八世紀念碑', subtitle: '1725 年 · 教宗青銅像：Giuseppe Bertosi',
    text: '從後殿走進左側迴廊時就在右手邊。由 Pietro Ottoboni 樞機委託、Arrigo di San Martino 設計，教宗青銅像由 Giuseppe Bertosi 製作，兩旁的審慎與宗教寓意像出自 Angelo de\' Rossi。基座正面浮雕描繪 1690 年 10 月 16 日五位聖人的封聖典禮。',
    station: [-43, 1.7, 23.5], look: [-50, 4.5, 23.5], hotspot: [-49, 8.5, 26], fov: 58,
    sources: [`${SP}/Monuments/AlexanderVIII/AlexanderVIII.htm`],
  },
  // ── 後殿 ──
  {
    id: 'founders_t', zone: 'apse', title: '創辦人像：後殿兩側', subtitle: '8 尊 · 修會創辦聖人像',
    text: '後殿（祭台後方的半圓殿前段）兩側柱面壁龕中的修會創辦人像：羅馬的方濟加 Frances of Rome（Pietro Galli，1850）、本篤 Benedict（Antonio Montauti，1735）、亞豐索 Alphonsus Liguori（Pietro Tenerani，1839）、亞西西的方濟各 Francis of Assisi（Carlo Monaldi，1727）、Francis Caracciolo（Laboureur 與 Fraccaroli，1834）、道明 Dominic（Pierre Le Gros，1706）、方濟·沙雷氏 Francis de Sales（Adamo Tadolini，1845）、先知厄里亞 Elijah（Agostino Cornacchini，1727）。（官方位置圖只標出分區，同區內各尊對應的壁龕此處不逐一標示。）',
    station: [-28, 1.7, 2.5], look: [-28, 10, 13.7], hotspot: [-25, 12.5, 12.5], fov: 62,
    sources: [`${SP}/Statues/Founders/FounderSaints.htm`],
  },
  {
    id: 'paul3', zone: 'apse', title: '保祿三世紀念碑', subtitle: 'Guglielmo della Porta · 青銅、大理石',
    text: '位於聖彼得寶座左側。上方是青銅的教宗坐像，下方兩尊大理石寓意人物為正義與審慎。原本放在別處，1628 年由貝尼尼移到這裡，與右側的烏爾巴諾八世紀念碑相對，左右夾著寶座。',
    station: [-48, 1.7, -2.5], look: [-60, 4.5, 11.2], hotspot: [-58.5, 8.5, 9.5], fov: 55,
    sources: [`${SP}/Monuments/PaulIII/PaulIII.htm`],
  },
  {
    id: 'cathedra', zone: 'apse', title: '聖彼得寶座 Cathedra Petri', subtitle: '貝尼尼 · 1666 年 1 月 17 日揭幕 · 鍍金青銅、大理石、灰泥',
    text: '後殿盡頭的鍍金青銅寶座，內藏一張傳統上被視為聖彼得所用的木椅；學者考證只有相思木骨架年代很早，其餘是後世重製。寶座由四位約 5 m 高的鍍金青銅教會聖師托起：外側戴主教冠的是拉丁教會的聖安博、聖奧斯定，內側不戴冠的是希臘教會的聖亞他那修、金口聖若望。上方的橢圓窗中是聖靈之鴿，四周環繞金色光芒與天使。1656 年亞歷山大七世委託貝尼尼設計。',
    station: [-24, 1.7, 0], look: [-64, 15, 0], hotspot: [-58, 9, 6.5], fov: 55, featured: true,
    sources: [`${SP}/Altars/Cathedra/Cathedra.htm`],
  },
  {
    id: 'urban8', zone: 'apse', title: '烏爾巴諾八世紀念碑', subtitle: '貝尼尼 · 1647 年完成 · 青銅、大理石',
    text: '位於聖彼得寶座右側，委託貝尼尼建造華蓋的就是這位教宗。上方的青銅教宗像舉手祝福；下方黑色大理石石棺兩旁是白色大理石的慈愛與正義寓意像，石棺上一具鍍金青銅骷髏正在書上寫下教宗的名字。',
    station: [-48, 1.7, 2.5], look: [-60, 4.5, -11.2], hotspot: [-58.5, 8.5, -9.5], fov: 55,
    sources: [`${SP}/Monuments/UrbanVIII/UrbanVIII.htm`],
  },
  // ── 聖彌額爾禮拜堂一帶（西北轉角） ──
  {
    id: 'clement10', zone: 'nwchapel', title: '克勉十世紀念碑', subtitle: 'Mattia de\' Rossi 設計 · 教宗像：Ercole Ferrata',
    text: '教宗坐像出自 Ercole Ferrata，兩旁的仁慈與寬仁寓意像分別由 Lazzaro Morelli 與 Giuseppe Mazzuoli 製作。基座浮雕描繪 1675 年禧年開啟聖門的場景。紀念碑前方地面一塊簡樸的墓石下，安葬著教宗思道四世與儒略二世。',
    station: [-43, 1.7, -23.5], look: [-50, 4.5, -23.5], hotspot: [-49, 8.5, -26], fov: 58,
    sources: [`${SP}/Monuments/ClementX/ClementX.htm`],
  },
  {
    id: 'petronilla', zone: 'nwchapel', title: '聖佩特羅尼拉祭台', subtitle: 'Guercino 原畫（1623） · Cristofari 1728–30 年製成馬賽克',
    text: '位於聖彌額爾與聖佩特羅尼拉禮拜堂的後方。祭壇畫依 Guercino 的作品製成馬賽克，原畫今藏卡比托利歐美術館。祭台下安放聖佩特羅尼拉的聖髑。在羅馬的法國信眾每年 5 月 31 日在此聚會。',
    station: [-44, 1.7, -47], look: [-54, 5, -44.5], hotspot: [-53, 9, -47], fov: 58,
    sources: [`${SP}/Altars/StPetronilla/StPetronilla.htm`],
    art: ['petronilla'],
  },
  {
    id: 'michael', zone: 'nwchapel', title: '聖彌額爾總領天使祭台', subtitle: '依 Guido Reni 原作 · 1757–1758 年馬賽克',
    text: '祭壇畫依 Guido Reni 為羅馬嘉布遣會聖母堂所繪的《聖彌額爾》製成馬賽克。此處 1628 年設置的前一幅馬賽克，是新聖彼得大教堂中第一幅馬賽克祭壇畫，今存於馬切拉塔主教座堂。',
    station: [-40, 1.7, -48], look: [-43.5, 5, -56], hotspot: [-41, 9.5, -55], fov: 58,
    sources: [`${SP}/Altars/StMichaelArchangel/StMichaelArchangel.htm`],
    art: ['michael'],
  },
  {
    id: 'tabitha', zone: 'nwchapel', title: '聖伯多祿使塔比莎復活祭台', subtitle: 'Placido Costanzi 原畫 · 1758–1760 年製成馬賽克',
    text: '描繪宗徒大事錄第 9 章，伯多祿使約培的女門徒塔比莎死而復活。原畫由 Placido Costanzi 繪製，今藏羅馬天使與殉道者聖母大殿；祭台兩旁是灰色花崗岩柱。',
    station: [-44, 1.7, -40], look: [-33, 5, -40], hotspot: [-34, 9.5, -42.5], fov: 58,
    sources: [`${SP}/Altars/StPeter-Tabitha/StPeter-Tabitha.htm`],
    noImage: '塔比莎祭台',
  },
  {
    id: 'navaltar', zone: 'nwchapel', title: '《小船》祭台', subtitle: 'Giovanni Lanfranco 原作 · 1726/27 年製成馬賽克',
    text: '位於聖海倫娜巨柱背面，與柱廊上喬托的《小船》是不同作品。描繪在水面上將要下沉的伯多祿向耶穌求救。祭壇畫依 Lanfranco 1628 年完成的壁畫製成馬賽克；兩旁的 brocatello 大理石柱是大教堂中僅有的一對。祭台下有聖曼蘇埃圖斯與聖霍內斯圖斯的聖髑。',
    station: [-37.5, 1.7, -43], look: [-37.5, 5, -33], hotspot: [-35, 9.5, -34], fov: 58,
    sources: [`${SP}/Altars/Navicella/Navicella.htm`],
    art: ['navaltar'],
  },
  // ── 右耳堂 ──
  {
    id: 'clement13', zone: 'ntransept', title: '克勉十三世紀念碑', subtitle: '安東尼奧·卡諾瓦 · 1783–1792 · 卡拉拉大理石',
    text: '新古典主義雕塑家卡諾瓦的早期代表作，前後花了近十年。教宗跪在高處默禱，墓門兩側蹲伏著兩頭石獅，一醒一睡。',
    station: [4, 1.7, -40], look: [-13.7, 5.5, -40], hotspot: [-12.3, 10, -36.8], fov: 55, featured: true,
    sources: [`${SP}/Monuments/ClementXIII/ClementXIII.htm`],
  },
  {
    id: 'ntransaltars', zone: 'ntransept', title: '右耳堂三祭台', subtitle: '聖普羅策素與瑪爾定 · 聖伊拉斯謨 · 聖文策老',
    text: '中央是聖普羅策素與瑪爾定祭台，馬賽克依 Valentin de Boulogne 的原畫製作（原畫今藏梵蒂岡美術館），祭台下的斑岩甕安放兩位聖人的聖髑。左側是聖伊拉斯謨祭台，馬賽克依普桑（Nicolas Poussin）1628–29 年的原畫製作，原畫同樣藏於梵蒂岡美術館。右側是聖文策老祭台，馬賽克依 Angelo Caroselli 的原畫製作，兩旁另有聖濟利祿與聖默道的馬賽克。',
    station: [0, 1.7, -45], look: [0, 6, -68], hotspot: [-2.5, 11.5, -66.5], fov: 62,
    sources: [`${SP}/Altars/StsProcessus&Martinian/StsProcessus&Martinian.htm`, `${SP}/Altars/StErasmus/StErasmus.htm`, `${SP}/Altars/StWenceslas/StWenceslas.htm`],
    noImage: '聖文策老祭台',
    art: ['processus', 'erasmus'],
  },
  // ── 中殿右側與右側廊（回程） ──
  {
    id: 'peter', zone: 'naisle', title: '聖彼得青銅像', subtitle: '約 1300 年 · 一說 Arnolfo di Cambio 作 · 青銅',
    text: '倚靠聖朗基努斯巨柱的青銅坐像，聖彼得右手祝福，左手持天國的鑰匙。多數學者認為作於 13 世紀末，但也有人認為是 5 世紀的鑄件。數百年來朝聖者親吻、觸摸他伸出的右腳，使腳趾磨得光亮平滑。雪花石膏底座是 1757 年 Carlo Marchionni 的作品。每年 6 月 29 日聖伯多祿節，雕像會穿上祭袍、戴上三重冕。',
    station: [36, 1.7, -3], look: [29.5, 3.2, -12.1], hotspot: [30.5, 5.6, -11.5], fov: 50, featured: true,
    sources: [`${SP}/Statues/StPeter/StPeter.htm`],
  },
  {
    id: 'jerome', zone: 'naisle', title: '聖熱羅尼莫祭台（聖若望二十三世）', subtitle: 'Domenichino 原作的馬賽克複製',
    text: '位於聖朗基努斯巨柱背面，緊鄰聖彼得青銅像，是右側廊的盡頭。祭台下安放教宗聖若望二十三世的遺體，2001 年遷入。祭壇畫是 Domenichino《聖熱羅尼莫最後的聖餐》（1614）的馬賽克複製，原作今藏梵蒂岡美術館。',
    station: [44, 1.7, -25], look: [33, 4.5, -25], hotspot: [34, 9.5, -28], fov: 55,
    sources: [`${SP}/Altars/StJerome/StJerome.htm`],
    art: ['jerome'],
  },
  {
    id: 'gregorian', zone: 'naisle', title: '額我略禮拜堂與援助聖母祭台', subtitle: '米開朗基羅始建 · 德拉·波爾塔完成',
    text: '大教堂四座轉角禮拜堂之一，以教宗額我略十三世命名，小穹頂高約 42 m。祭台上的《援助聖母》是 12 世紀的木板聖像，1578 年由額我略十三世從舊大教堂遷來；祭台下的斑岩甕中安放納齊安的聖額我略的遺骸。',
    station: [40, 1.7, -21], look: [40, 9, -33], hotspot: [42.5, 11, -31.5], fov: 66,
    sources: [`${SP}/Altars/GregorianChapel/GregorianChapel.htm`, `${SP}/Altars/OurLadyofSuccour/OurLadyofSuccour.htm`],
    art: ['succour'],
  },
  {
    id: 'sacrament', zone: 'naisle', title: '聖體禮拜堂', subtitle: '聖體龕：貝尼尼，1674 年 · 鐵門：博羅米尼',
    text: '右側廊最大的禮拜堂，現實中僅供祈禱者進入，所以這裡只在鐵門外觀看。內有貝尼尼設計的鍍金青銅與青金石聖體龕，造型取自布拉曼特的小聖堂，兩旁跪著兩位鍍金青銅天使；祭壇畫是 Pietro da Cortona 的《聖三》。入口鐵門由博羅米尼設計。',
    station: [82, 1.7, -22], look: [82, 5, -33], hotspot: [85, 9.5, -32], fov: 58,
    sources: [`${SP}/Altars/BlSacrament/BlSacrament.htm`],
    noImage: '《聖三》',
  },
  {
    id: 'matilda', zone: 'naisle', title: '瑪蒂爾達女伯爵紀念碑', subtitle: '貝尼尼與工作室 · 1633–1637 · 大理石',
    text: '紀念 11 世紀支持教宗的托斯卡尼女伯爵瑪蒂爾達。她一手持權杖、一手抱著教宗的三重冕與鑰匙。石棺正面由 Stefano Speranza 刻的浮雕，描繪 1077 年皇帝亨利四世在她的卡諾莎城堡向教宗額我略七世求赦的「卡諾莎之行」。',
    station: [89, 1.7, -26.5], look: [89, 4.8, -17], hotspot: [91, 8, -18], fov: 55,
    sources: [`${SP}/Monuments/MatildaofCanossa/MatildaofCanossa.htm`],
  },
  {
    id: 'sebastian', zone: 'naisle', title: '聖塞巴斯蒂安禮拜堂（聖若望保祿二世）', subtitle: 'Domenichino 原作的馬賽克複製（1730–1736）',
    text: '祭台下安放教宗聖若望保祿二世之墓：他在 2011 年 5 月 1 日宣福後遷葬於此，2014 年 4 月 27 日封聖。祭壇畫是 Domenichino《聖塞巴斯蒂安殉道》的馬賽克複製。禮拜堂兩側為庇護十一世像（Francesco Nagni，1949）與庇護十二世像（Francesco Messina，1964）。',
    station: [96, 1.7, -22], look: [96, 4.5, -33], hotspot: [98.5, 9.5, -32], fov: 58, featured: true,
    sources: [`${SP}/Altars/StSebastian/StSebastian.htm`],
    art: ['sebastian'],
  },
  {
    id: 'christina', zone: 'naisle', title: '瑞典女王克莉絲蒂娜紀念碑', subtitle: 'Carlo Fontana 設計 · 1702 年 · 鍍金青銅、大理石',
    text: '位於右側廊第一根柱子上。克莉絲蒂娜放棄王位、改信天主教後定居羅馬。紀念碑上方是她的鍍金青銅肖像圓章，下方白色大理石浮雕描繪她 1655 年在因斯布魯克公開放棄新教信仰的場景。',
    station: [103, 1.7, -26.5], look: [103, 4.5, -17], hotspot: [105, 8, -18], fov: 55,
    sources: [`${SP}/Monuments/ChristinaofSweden/ChristinaofSweden.htm`],
  },
  {
    id: 'pieta', zone: 'naisle', title: '聖殤 Pietà', subtitle: '米開朗基羅 · 1498–1499 · 卡拉拉大理石 174 × 195 cm',
    text: '入口右側第一座禮拜堂，緊鄰聖門。米開朗基羅二十四歲時完成，也是他唯一簽名的作品，名字刻在聖母胸前的飾帶上。聖母懷抱基督遺體，神情平靜而年輕。1972 年 5 月 21 日遭人以鎚子連擊 15 次，修復後置於防彈玻璃之後；這層玻璃在 2024 年 11 月更新。',
    station: [110, 1.7, -19.5], look: [110, 2.6, -31], hotspot: [113, 4.8, -29], fov: 50, featured: true,
    sources: [`${SP}/Altars/Pieta/Pieta.htm`, `${WK}Piet%C3%A0_(Michelangelo)`],
    scan: {
      url: 'models/pieta-mary.glb',
      title: '真實掃描：聖殤的聖母局部',
      credit: '掃描對象：經梵蒂岡博物館授權、由大都會博物館以原作直接翻模製成的翻模件 · 掃描：Cosmo Wenman',
      license: 'CC BY',
      source: 'https://sketchfab.com/3d-models/michelangelos-pieta-detail-of-mary-b04b5b4ac759459fb1690711d34d8525',
    },
  },
];
