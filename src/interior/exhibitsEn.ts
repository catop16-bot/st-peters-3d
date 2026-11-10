/** 展品解說英文版（依與中文相同的出處翻譯，不另加內容） */
import type { Zone } from './exhibitsData';

export const ZONES_EN: Record<Zone, string> = {
  portico: 'Portico',
  nave: 'Entrance and nave',
  saisle: 'Left aisle',
  crossing: 'Dome and crossing',
  stransept: 'Left transept',
  swchapel: 'Chapel of Our Lady of the Column',
  apse: 'Apse',
  nwchapel: 'Chapel of St Michael',
  ntransept: 'Right transept',
  naisle: 'Right side of the nave and right aisle',
};

const FN = ' (The official location map marks only the section, so the niche of each statue is not shown here.)';

export const EXHIBITS_EN: Record<string, { title: string; subtitle: string; text: string }> = {
  charlemagne: {
    title: 'Equestrian statue of Charlemagne', subtitle: 'Agostino Cornacchini · 1725',
    text: 'At the southern end of the portico (the left end seen from outside), facing the statue of Constantine at the other end. Charlemagne was the first emperor crowned in St Peter\'s: Pope Leo III crowned him at Christmas in the year 800.',
  },
  navicella: {
    title: 'Navicella mosaic', subtitle: 'Attributed to Giotto · c. 1298 · mosaic (heavily restored)',
    text: 'Shows Christ walking on the water and reaching out to the disciples in the boat. Cardinal Stefaneschi commissioned it in 1298 for Old St Peter\'s. It was later moved to the portico, into the lunette above the central entrance, and has been restored many times; most of what is visible today is later work.',
  },
  constantine: {
    title: 'Equestrian statue of Constantine', subtitle: 'Bernini · commissioned 1654, completed 1670',
    text: 'At the northern end of the portico, at the foot of the Scala Regia leading to the Apostolic Palace. It shows the moment Constantine sees the vision of the cross in the sky, his horse rearing up, with a great stucco drapery behind. Innocent X commissioned it in 1654; it was unveiled under Clement X in 1670.',
  },
  filarete: {
    title: 'Filarete Door (central door)', subtitle: 'Antonio Averlino, "Filarete" · completed 1445 (or 1455) · bronze',
    text: 'The oldest of the five doors. Pope Eugenius IV commissioned it for Old St Peter\'s, and it was reused as the central door of the new basilica. On the lower part of the inner face are self-portraits of Filarete and his assistants.',
  },
  holydoor: {
    title: 'Holy Door', subtitle: 'Vico Consorti · 1949 (or 1950) · bronze',
    text: 'In the portico, the northernmost of the five doors. It stays closed except during a Jubilee. Consorti\'s bronze leaves have 16 relief panels in four rows and replaced the wooden doors of 1749 from 24 December 1949. Most recently it was opened for the 2025 Jubilee on 24 December 2024 and closed on 6 January 2026.',
  },
  rota: {
    title: 'Porphyry disc (Rota Porfiretica)', subtitle: 'Red porphyry · from Old St Peter\'s',
    text: 'The dark red porphyry disc inside the central door, brought from the old basilica. By tradition, Charlemagne knelt on this disc to be crowned emperor by Pope Leo III at Christmas in the year 800.',
  },
  nave: {
    title: 'Nave', subtitle: 'Carlo Maderno · begun 1607 · 186.3 m long inside · vault 45.5 m high',
    text: 'Maderno extended Michelangelo\'s Greek-cross plan eastwards into a Latin cross, making the interior 186.3 m long. The gilded, coffered barrel vault is 45.5 m high. Brass letters set into the nave floor mark the lengths of the world\'s great churches for comparison with St Peter\'s.',
  },
  stoups: {
    title: 'Holy-water stoups with cherubs', subtitle: '1722–1725 · marble',
    text: 'Under the first arch of the nave, one on each side: two cherubs hold a shell-shaped basin of yellow marble. They look like small children but are about 2 m tall; only up close do you sense the real scale of the church. Makers include Francesco Moderati and Giuseppe Lironi; sources differ on who did what.',
  },
  founders_s: {
    title: 'Founder saints: left side of the nave', subtitle: '8 statues · founders of religious orders',
    text: 'Statues of founders of religious orders in the upper and lower niches of the left (south) side of the nave: Lucy Filippini (Silvio Silva, 1949), Peter of Alcantara (Francesco Vergara, 1713), Louis Grignion de Montfort (Giacomo Parisini, 1948), Camillus de Lellis (Pietro Pacilli, 1753), Anthony Mary Zaccaria (Cesare Aureli, 1909), Ignatius Loyola (Camillo and Giuseppe Rusconi, 1733), Francis of Paola (G. B. Maini, 1732), Peter Fourier (Louis Noël Nicoli, 1899).' + FN,
  },
  founders_n: {
    title: 'Founder saints: right side of the nave', subtitle: '7 statues · founders of religious orders',
    text: 'Statues of founders of religious orders in the niches of the right (north) side of the nave. The lower position nearest the dome is the bronze St Peter, with John Bosco directly above it. The saints: John Bosco (Pietro Canonica, 1936), John Baptist de la Salle (Cesare Aureli, 1904), Philip Neri (G. B. Maini, 1737), Vincent de Paul (Pietro Bracci, 1754), John Eudes (Silvio Silva, 1932), Madeleine Sophie Barat (Enrico Quattrini, 1934), Teresa of Jesus (Filippo Della Valle, 1754).' + FN,
  },
  baptistery: {
    title: 'Baptistery', subtitle: 'Designed by Carlo Fontana · font cover completed 1698',
    text: 'The first chapel of the left aisle. The font is a single block of ancient red porphyry that once served as the lid of Emperor Otto II\'s sarcophagus; the gilded bronze cover above it follows Fontana\'s design. The altarpiece is a mosaic of the Baptism of Christ after Carlo Maratta.',
  },
  stuarts: {
    title: 'Monument to the Stuarts', subtitle: 'Antonio Canova · marble',
    text: 'Commemorates the last three members of the exiled British royal house of Stuart, who lived in Rome: James (the Old Pretender) and his sons Charles Edward and Henry. The white marble stele carries their profile portraits, and two mourning angels stand at either side of the tomb door below. Sources give different completion dates.',
  },
  innocent8: {
    title: 'Monument to Innocent VIII', subtitle: 'Antonio and Piero del Pollaiolo · 1498 · bronze',
    text: 'The only papal monument moved here from Old St Peter\'s, where it stood at the triumphal arch; it reached its present place in 1621. It has two figures of the pope, seated and lying. The seated pope holds the tip of the Holy Lance in his left hand, recalling that this relic was received during his reign.',
  },
  transfiguration: {
    title: 'Altar of the Transfiguration', subtitle: 'Mosaic copy of Raphael\'s painting · completed 1767',
    text: 'On the outer side of the St Andrew pier, at the end of the left aisle. The Transfiguration was Raphael\'s last painting, unfinished at his death in 1520 and completed by his pupils; the original is in the Vatican Pinacoteca. This is an 18th-century mosaic copy; most of the "paintings" on the basilica\'s altars are mosaic copies like this.',
  },
  clementine: {
    title: 'Clementine Chapel and altar of St Gregory the Great', subtitle: 'Built for the 1600 Jubilee · dome mosaics designed by Roncalli (1603)',
    text: 'One of the basilica\'s four corner chapels, completed by Pope Clement VIII for the Jubilee of 1600. A white marble sarcophagus under the altar holds the remains of Pope St Gregory the Great, moved here in 1606. The altarpiece is a mosaic of the Miracle of St Gregory after Andrea Sacchi. The chapel also holds the Danish sculptor Thorvaldsen\'s monument to Pius VII (1831).',
  },
  confessio: {
    title: 'Confessio', subtitle: 'Carlo Maderno · 1615–1617',
    text: 'The sunken semicircular space in front of the papal altar, facing what tradition holds to be the tomb of St Peter beneath the altar. Forty-six cornucopia-shaped oil lamps line its marble balustrade.',
  },
  baldacchino: {
    title: 'Bernini\'s Baldacchino', subtitle: 'Bernini · 1624–1633 (or 1623–1634) · bronze · about 29 m high',
    text: 'The huge bronze canopy over the papal altar stands on four Solomonic twisted columns about 20 m high, wound with laurel and decorated with the bees of the Barberini family of Urban VIII, who commissioned it. Inside the canopy is the dove of the Holy Spirit in golden rays. It was unveiled on the feast of St Peter in 1633. Directly beneath the altar is what tradition holds to be St Peter\'s tomb.',
  },
  dome: {
    title: 'Michelangelo\'s dome (interior)', subtitle: 'Designed by Michelangelo · completed by della Porta in 1590 · 41.5 m across',
    text: '117.57 m from the floor to the inner vault of the lantern. Sixteen windows in the drum let in daylight; inside, 16 ribs divide the dome into 16 segments covered in mosaic. The Latin inscription around its base is from Matthew 16:18–19: "You are Peter, and on this rock I will build my church… I will give you the keys of the kingdom of heaven." The letters are about 1.4 m high (another record says 2 m).',
  },
  piers: {
    title: 'Statues of the four piers', subtitle: 'Bernini, Bolgi, Mochi, Duquesnoy · 1630s · marble',
    text: 'Each of the four piers holding up the dome has a statue about 5 m tall in its niche (St Andrew is 4.68 m), each linked to a relic kept in the basilica: St Longinus holding the lance (Bernini), St Helena holding the cross (Andrea Bolgi), St Veronica showing the veil (Francesco Mochi) and St Andrew leaning on his X-shaped cross (François Duquesnoy). The balconies above are where the relics are kept. On 18 April 1506 Pope Julius II laid the foundation stone of the new church under the St Veronica pier.',
  },
  founders_w: {
    title: 'Founder saints: west side of the transepts', subtitle: '8 statues · founders of religious orders',
    text: 'Statues of founders of religious orders in the upper and lower niches on the west side of both transepts: William (Giuseppe Prinzi, 1878), Norbert (Pietro Bracci, 1767), Angela Merici (Pietro Galli, 1866), Juliana Falconieri (Paolo Campi, 1740), Paul of the Cross (Ignazio Iacometti, 1876), Bruno (Michelangelo Slodtz, 1744), Bonfilius Monaldi (Cesare Aureli, 1906), Joseph Calasanctius (Innocenzo Spinazzi, 1755).' + FN,
  },
  founders_e: {
    title: 'Founder saints: east side of the transepts', subtitle: '8 statues · founders of religious orders',
    text: 'Statues of founders of religious orders in the upper and lower niches on the east side of both transepts: Joan Antida Thouret (Enrico and Carlo Quattrini, 1949), Jerome Emiliani (Pietro Bracci, 1757), Frances Cabrini (Enrico Tadolini, 1947), Cajetan Thiene (Carlo Monaldi, 1738), Mary Euphrasia Pelletier (Giovanni Nicolini, 1942), John of God (Filippo Della Valle, 1745), Louise de Marillac (Antonio Berti, 1954), Peter Nolasco (Paolo Campi, 1742).' + FN,
  },
  stransaltars: {
    title: 'The three altars of the left transept', subtitle: 'St Joseph · St Thomas · Crucifixion of St Peter',
    text: 'In the centre is the altar of St Joseph: Achille Funi\'s painting of 1961 was made into a mosaic in 1963 and blessed by John XXIII on 19 March that year; an ancient sarcophagus under the altar holds relics of Sts Simon and Jude Thaddeus. On the right is the altar of St Thomas, whose mosaic after Vincenzo Camuccini shows the Incredulity of Thomas; under it are relics of Pope St Boniface IV. On the left is the altar of the Crucifixion of St Peter, with a mosaic after Guido Reni\'s painting, now in the Vatican Pinacoteca.',
  },
  alexander: {
    title: 'Monument to Alexander VII', subtitle: 'Bernini · 1671–1678 · marble, Sicilian jasper, gilded bronze',
    text: 'A late work by Bernini on the outer wall of the left (south) transept, built around a door that leads out of the basilica. The pope kneels in prayer at the top, surrounded by Charity, Truth, Prudence and Justice. Below, a gilded bronze skeleton emerges from a drapery of red jasper, raising an hourglass as a reminder that life is short.',
  },
  sacredheart: {
    title: 'Altar of the Sacred Heart', subtitle: 'Painting by Carlo Muccioli · made into mosaic 1920–1925',
    text: 'On the south side of the St Veronica pier. It shows the Sacred Heart of Jesus appearing to St Margaret Mary Alacoque. Carlo Muccioli painted the original in 1919–20 and it was made into a mosaic in 1920–25, replacing Francesco Vanni\'s Fall of Simon Magus; the altar was rededicated in 1923.',
  },
  cripple: {
    title: 'Altar of St Peter healing the cripple', subtitle: 'Painting by Francesco Mancini (1748) · made into mosaic 1751–1758',
    text: 'Shows Acts chapter 3: Peter heals a man lame from birth at the gate of the Temple. Francesco Mancini painted the original in 1748; the mosaic was completed in 1751–58. The first altarpiece here was by Cigoli (1604–06) and is now lost.',
  },
  column: {
    title: 'Chapel and altar of Our Lady of the Column', subtitle: 'Chapel designed by Giacomo della Porta · image placed here in 1607',
    text: 'A corner chapel beside the apse, also called the Chapel of St Leo; its small dome is decorated with themes from the Litany of Loreto. The image of the Virgin on the altar is painted on a marble column from the nave of Old St Peter\'s. It was placed here under Paul V in 1607 and crowned in 1645; in 1964 Paul VI honoured her with the title "Mother of the Church". A 4th-century sarcophagus under the altar holds the remains of Popes Leo II, Leo III and Leo IV.',
  },
  leo: {
    title: 'Altar of St Leo the Great', subtitle: 'Alessandro Algardi · 1646–1653 · marble high relief',
    text: 'On the right side of the Chapel of Our Lady of the Column, between black granite columns. The altarpiece is a single marble high relief showing Pope Leo I meeting Attila the Hun and persuading him not to attack Rome. It is the only altar in the basilica whose altarpiece is a large marble relief.',
  },
  alexander8: {
    title: 'Monument to Alexander VIII', subtitle: '1725 · bronze statue by Giuseppe Bertosi',
    text: 'On your right as you leave the apse for the left ambulatory. Commissioned by Cardinal Pietro Ottoboni and designed by Arrigo di San Martino; the bronze statue of the pope is by Giuseppe Bertosi, and the figures of Prudence and Religion on either side are by Angelo de\' Rossi. The relief on the front of the base shows the canonisation of five saints on 16 October 1690.',
  },
  founders_t: {
    title: 'Founder saints: sides of the apse', subtitle: '8 statues · founders of religious orders',
    text: 'Statues of founders of religious orders in the niches on both sides of the apse (the arm behind the papal altar): Frances of Rome (Pietro Galli, 1850), Benedict (Antonio Montauti, 1735), Alphonsus Liguori (Pietro Tenerani, 1839), Francis of Assisi (Carlo Monaldi, 1727), Francis Caracciolo (Laboureur and Fraccaroli, 1834), Dominic (Pierre Le Gros, 1706), Francis de Sales (Adamo Tadolini, 1845), the prophet Elijah (Agostino Cornacchini, 1727).' + FN,
  },
  paul3: {
    title: 'Monument to Paul III', subtitle: 'Guglielmo della Porta · bronze and marble',
    text: 'To the left of the Chair of St Peter. Above is a bronze seated figure of the pope; below are two marble allegories, Justice and Prudence. It originally stood elsewhere and was moved here by Bernini in 1628, facing the monument to Urban VIII on the other side so that the two frame the Chair.',
  },
  cathedra: {
    title: 'Chair of St Peter (Cathedra Petri)', subtitle: 'Bernini · unveiled 17 January 1666 · gilded bronze, marble, stucco',
    text: 'The gilded bronze throne at the end of the apse encloses a wooden chair traditionally held to be St Peter\'s; scholars find that only its acacia-wood frame is early and the rest is later reconstruction. Four gilded bronze Doctors of the Church about 5 m tall support it: on the outside, wearing mitres, the Latin fathers Ambrose and Augustine; on the inside, bare-headed, the Greek fathers Athanasius and John Chrysostom. Above, the dove of the Holy Spirit fills an oval window, surrounded by golden rays and angels. Alexander VII commissioned the design from Bernini in 1656.',
  },
  urban8: {
    title: 'Monument to Urban VIII', subtitle: 'Bernini · completed 1647 · bronze and marble',
    text: 'To the right of the Chair of St Peter. This is the pope who commissioned Bernini\'s Baldacchino. Above, the bronze pope raises his hand in blessing; below, white marble figures of Charity and Justice stand beside the black marble sarcophagus, on which a gilded bronze skeleton writes the pope\'s name in a book.',
  },
  petronilla: {
    title: 'Altar of St Petronilla', subtitle: 'Painting by Guercino (1623) · mosaic by Cristofari, 1728–30',
    text: 'At the back of the Chapel of Sts Michael and Petronilla. The altarpiece is a mosaic after Guercino\'s painting, now in the Capitoline Museums. Relics of St Petronilla lie under the altar. The French community in Rome gathers here every year on 31 May.',
  },
  michael: {
    title: 'Altar of St Michael the Archangel', subtitle: 'After Guido Reni · mosaic of 1757–1758',
    text: 'The altarpiece is a mosaic after Guido Reni\'s St Michael, painted for Santa Maria della Concezione dei Cappuccini in Rome. The earlier mosaic set up here in 1628 was the first mosaic altarpiece in the new St Peter\'s; it is now in Macerata Cathedral.',
  },
  tabitha: {
    title: 'Altar of St Peter raising Tabitha', subtitle: 'Painting by Placido Costanzi · made into mosaic 1758–1760',
    text: 'Shows Acts chapter 9, in which Peter raises the disciple Tabitha of Joppa from the dead. Placido Costanzi painted the original, now in Santa Maria degli Angeli in Rome; grey granite columns flank the altar.',
  },
  navaltar: {
    title: 'Altar of the Navicella', subtitle: 'After Giovanni Lanfranco · mosaic of 1726/27',
    text: 'Behind the St Helena pier; a different work from Giotto\'s Navicella in the portico. It shows Peter sinking in the water and calling to Jesus for help. The altarpiece is a mosaic after Lanfranco\'s fresco, completed in 1628. Its brocatello marble columns are the only pair in the basilica. Relics of Sts Mansuetus and Honestus lie under the altar.',
  },
  clement13: {
    title: 'Monument to Clement XIII', subtitle: 'Antonio Canova · 1783–1792 · Carrara marble',
    text: 'An early masterpiece of the neoclassical sculptor Canova, nearly ten years in the making. The pope kneels in prayer at the top; two lions crouch on either side of the tomb door, one awake and one asleep.',
  },
  ntransaltars: {
    title: 'The three altars of the right transept', subtitle: 'Sts Processus and Martinian · St Erasmus · St Wenceslas',
    text: 'In the centre is the altar of Sts Processus and Martinian, with a mosaic after Valentin de Boulogne\'s painting (now in the Vatican Pinacoteca); a porphyry urn under the altar holds the two saints\' relics. On the left is the altar of St Erasmus, with a mosaic after Nicolas Poussin\'s painting of 1628–29, also in the Vatican Pinacoteca. On the right is the altar of St Wenceslas, with a mosaic after Angelo Caroselli\'s painting and side mosaics of Sts Cyril and Methodius.',
  },
  peter: {
    title: 'Bronze statue of St Peter', subtitle: 'c. 1300 · attributed by some to Arnolfo di Cambio · bronze',
    text: 'A seated bronze figure against the St Longinus pier; Peter blesses with his right hand and holds the keys of heaven in his left. Most scholars date it to the late 13th century, though some think it a 5th-century casting. Centuries of pilgrims kissing and touching his outstretched right foot have worn the toes smooth. The alabaster base is by Carlo Marchionni (1757). Every year on 29 June, the feast of St Peter, the statue is dressed in vestments and a tiara.',
  },
  jerome: {
    title: 'Altar of St Jerome (St John XXIII)', subtitle: 'Mosaic copy after Domenichino',
    text: 'At the back of the St Longinus pier, next to the bronze St Peter, closing the right aisle. The body of Pope St John XXIII lies under the altar, moved here in 2001. The altarpiece is a mosaic copy of Domenichino\'s Last Communion of St Jerome (1614), now in the Vatican Pinacoteca.',
  },
  gregorian: {
    title: 'Gregorian Chapel and altar of Our Lady of Succour', subtitle: 'Begun by Michelangelo · completed by della Porta',
    text: 'One of the basilica\'s four corner chapels, named after Pope Gregory XIII; its dome is about 42 m high. The Madonna of Succour on the altar is a 12th-century icon on wood, brought from the old basilica by Gregory XIII in 1578. A porphyry urn under the altar holds the remains of St Gregory of Nazianzus.',
  },
  sacrament: {
    title: 'Chapel of the Blessed Sacrament', subtitle: 'Tabernacle: Bernini, 1674 · gate: Borromini',
    text: 'The largest chapel of the right aisle. In reality it is open only to those who wish to pray, so here you see it from outside the gate. Inside is Bernini\'s tabernacle of gilded bronze and lapis lazuli, modelled on Bramante\'s Tempietto, with two kneeling gilded bronze angels; the altarpiece is Pietro da Cortona\'s Holy Trinity. The iron entrance gate was designed by Borromini.',
  },
  matilda: {
    title: 'Monument to Matilda of Canossa', subtitle: 'Bernini and workshop · 1633–1637 · marble',
    text: 'Commemorates Matilda, the 11th-century Countess of Tuscany who supported the papacy. She holds a sceptre in one hand and the papal tiara and keys in the other. The relief on the front of the sarcophagus, carved by Stefano Speranza, shows Emperor Henry IV seeking Pope Gregory VII\'s pardon at her castle of Canossa in 1077.',
  },
  sebastian: {
    title: 'Chapel of St Sebastian (St John Paul II)', subtitle: 'Mosaic copy after Domenichino (1730–1736)',
    text: 'The tomb of Pope St John Paul II lies under the altar: he was moved here after his beatification on 1 May 2011 and canonised on 27 April 2014. The altarpiece is a mosaic copy of Domenichino\'s Martyrdom of St Sebastian. On either side stand statues of Pius XI (Francesco Nagni, 1949) and Pius XII (Francesco Messina, 1964).',
  },
  christina: {
    title: 'Monument to Queen Christina of Sweden', subtitle: 'Designed by Carlo Fontana · 1702 · gilded bronze and marble',
    text: 'On the first pier of the right aisle. Christina gave up her throne, became a Catholic and settled in Rome. Above is her portrait medallion in gilded bronze; below, a white marble relief shows her public renunciation of Protestantism at Innsbruck in 1655.',
  },
  pieta: {
    title: 'Pietà', subtitle: 'Michelangelo · 1498–1499 · Carrara marble, 174 × 195 cm',
    text: 'In the first chapel on the right of the entrance, next to the Holy Door. Michelangelo finished it at 24, and it is the only work he signed, with his name carved on the sash across the Virgin\'s chest. Mary holds the body of Christ, her face calm and young. On 21 May 1972 it was struck 15 times with a hammer; after restoration it was placed behind bulletproof glass, which was renewed in November 2024.',
  },
};
