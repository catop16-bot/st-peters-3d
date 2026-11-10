// 聖彼得大教堂與廣場的真實尺寸（公尺）
// 來源：OpenStreetMap 3D 建築資料（building:part 高度/位置）、Wikipedia「St. Peter's Basilica」「St. Peter's Square」
// 以及立面照片（Wikimedia Commons）比例量測。座標為以方尖碑為原點的本地座標（X 東、Z 南）。

export const DIM = {
  // ─── 大教堂整體 ───
  basilica: {
    domeCenter: [-321.0, 6.0] as [number, number], // OSM: Cupola di San Pietro
    facadeCenter: [-189.0, 4.2] as [number, number], // OSM: 立面頂端基督像位置
    floorY: 4.2, // 教堂地坪相對廣場高差（三段階梯）
    bodyHeight: 44.0, // 米開朗基羅外牆頂部（OSM 主體 building:part 47）
    facadeWallX: 132.5, // 立面牆面距穹頂中心（沿軸線）
    facadeBackX: 117.0, // 立面塊體後緣
    facadeHalfWidth: 57.35, // 立面寬 114.69 m
    facadeHeight: 45.55,
  },
  // ─── 馬德諾立面 ───
  facade: {
    columnZ: [5.5, 12.0, 17.0, 27.0], // OSM 立面 8 根科林斯巨柱位置（對稱）
    pilasterZ: [40.0, 55.0], // 外側壁柱（照片量測）
    columnRadius: 1.38,
    orderTop: 27.0, // 柱頭頂
    entablatureTop: 32.5,
    atticTop: 42.5,
    atticCorniceTop: 43.6,
    balustradeTop: 45.55,
    pedimentHalfWidth: 15.5,
    pedimentApex: 41.2,
    clockZ: 47.5,
    statueHeight: 5.7, // 13 尊立面雕像（基督、施洗約翰與 11 位使徒）
    inscription: 'IN HONOREM PRINCIPIS APOST PAVLVS V BVRGHESIVS ROMANVS PONT MAX AN MDCXII PONT VII',
  },
  // ─── 米開朗基羅主穹頂（由地坪起算）───
  dome: {
    podiumTop: 54.0, // OSM: 54–60 為鼓座基環
    drumBase: 60.0,
    drumColumnTop: 74.0,
    drumEntablatureTop: 77.0,
    drumAtticTop: 81.0,
    shellTop: 111.0, // 外殼頂（燈籠亭基座）
    lanternTop: 126.0,
    coneTop: 132.0,
    ballCenter: 133.4,
    crossTop: 136.57, // 十字架頂 136.57 m
    drumRadius: 29.6,
    buttressRadius: 32.6,
    shellRadius: 29.4, // 外殼起拱半徑（外徑約 58.9 m）
    lanternRadius: 6.4,
    ribs: 16,
  },
  minorDomes: {
    offsets: [[35, 37], [35, -38], [-39, 37], [-39, -38]] as [number, number][], // OSM 四座小穹頂
    drumBase: 47.0,
    drumTop: 56.5,
    shellTop: 65.0,
    lanternTop: 71.5,
    radius: 7.6,
  },
  // ─── 貝尼尼柱廊 ───
  colonnade: {
    centers: [[0.9, 27.0], [0.9, -27.0]] as [number, number][], // 兩弧圓心（即廣場上兩塊「柱廊中心」斑岩圓盤）
    rows: [70.6, 75.6, 83.0, 87.9], // 四列柱子的半徑（中央走道較寬）
    innerR: 69.4,
    outerR: 89.2,
    angleFrom: 17, // 度（以圓心為基準，南臂 +，北臂 -）
    angleTo: 163,
    columnTop: 13.3,
    entablatureTop: 16.2,
    balustradeTop: 17.9,
    statueHeight: 3.1, // 140 尊聖人像，每尊約 3.1 m
    radialLines: 71, // 284 根柱子 = 71 條徑向線 × 4 列（兩臂合計）
  },
  // ─── 廣場 ───
  piazza: {
    obeliskShaft: 25.5, // 方尖碑碑身 25.5 m，含基座與十字約 41 m
    obeliskTotal: 41.0,
    fountains: [
      { name: 'Fontana di Maderno', pos: [-2.0, -61.0] as [number, number], year: 1613 },
      { name: 'Fontana di Bernini', pos: [1.0, 58.0] as [number, number], year: 1677 },
    ],
    retta: { fromX: -67, stepsStartX: -132, stepsEndX: -147, rampTopY: 1.2 },
    statuePeter: [-124.5, 40.8] as [number, number],
    statuePaul: [-125.1, -35.6] as [number, number],
  },
};

export const LANDMARK_INFO: Record<string, { title: string; text: string; titleEn: string; textEn: string }> = {
  basilica: {
    title: '聖彼得大教堂 Basilica di San Pietro',
    text: '1506–1626 年興建，由布拉曼特、米開朗基羅、馬德諾、貝尼尼等人接續完成。內部長約 186 m，為世界最大的教堂之一。',
    titleEn: "St. Peter's Basilica",
    textEn: 'Built 1506–1626 by a succession of architects including Bramante, Michelangelo, Maderno and Bernini. About 186 m long inside, it is one of the largest churches in the world.',
  },
  dome: {
    title: '米開朗基羅穹頂',
    text: '米開朗基羅設計、賈科莫·德拉·波爾塔於 1590 年完成。內徑約 41.5 m，地面至十字架頂 136.57 m。',
    titleEn: "Michelangelo's dome",
    textEn: 'Designed by Michelangelo and completed by Giacomo della Porta in 1590. About 41.5 m across inside; 136.57 m from the ground to the top of the cross.',
  },
  facade: {
    title: '馬德諾立面',
    text: '卡洛·馬德諾 1608–1614 年設計，寬 114.69 m、高 45.55 m。頂部 13 尊雕像為基督、施洗約翰與 11 位使徒（聖彼得像不在其中）。',
    titleEn: "Maderno's facade",
    textEn: 'Designed by Carlo Maderno, 1608–1614; 114.69 m wide and 45.55 m high. The 13 statues on top are Christ, John the Baptist and 11 apostles (St Peter is not among them).',
  },
  colonnade: {
    title: '貝尼尼柱廊',
    text: '貝尼尼 1656–1667 年設計。284 根多立克柱、88 根壁柱分四列環抱廣場，頂上 140 尊聖人像。站在斑岩「柱廊中心」圓盤上，四列柱會重疊成一列。',
    titleEn: "Bernini's colonnade",
    textEn: 'Designed by Bernini, 1656–1667. 284 Doric columns and 88 pilasters in four rows embrace the square, with 140 statues of saints on top. Stand on the porphyry "centre of the colonnade" disc and the four rows line up as one.',
  },
  obelisk: {
    title: '梵蒂岡方尖碑',
    text: '古埃及花崗岩方尖碑，37 年由卡利古拉運至羅馬，1586 年由多梅尼科·豐塔納遷至現址。碑身 25.5 m，連基座與十字約 41 m。',
    titleEn: 'Vatican obelisk',
    textEn: 'An ancient Egyptian granite obelisk, brought to Rome by Caligula in AD 37 and moved to this spot by Domenico Fontana in 1586. The shaft is 25.5 m; about 41 m with base and cross.',
  },
};
