// Sport configuration: each sport has a "game" series (the winner market, which
// defines the game list) and a set of per-game bet-type series. Every bet-type
// event for a game shares the same code suffix as the game event, e.g.
// KXWNBAGAME-26AUG01NYPHX ⇄ KXWNBASPREAD-26AUG01NYPHX.

export interface BetSeries {
  key: string;
  label: string;
  prefix: string;
}

export interface Sport {
  key: string;
  label: string;
  gameSeries: string;
  bets: BetSeries[];
}

// MLB bet-type series (verified against the live API).
const MLB_BETS: BetSeries[] = [
  { key: 'winner', label: 'Game Winner', prefix: 'KXMLBGAME' },
  { key: 'spread', label: 'Run Line (Spread)', prefix: 'KXMLBSPREAD' },
  { key: 'total', label: 'Total Runs (Over/Under)', prefix: 'KXMLBTOTAL' },
  { key: 'teamtotal', label: 'Team Total Runs', prefix: 'KXMLBTEAMTOTAL' },
  { key: 'rfi', label: 'Run in 1st Inning (YRFI / NRFI)', prefix: 'KXMLBRFI' },
  { key: 'f3', label: 'First 3 Innings — Winner', prefix: 'KXMLBF3' },
  { key: 'f5', label: 'First 5 Innings — Winner', prefix: 'KXMLBF5' },
  { key: 'f5spread', label: 'First 5 Innings — Spread', prefix: 'KXMLBF5SPREAD' },
  { key: 'f5total', label: 'First 5 Innings — Total', prefix: 'KXMLBF5TOTAL' },
  { key: 'f7', label: 'First 7 Innings — Winner', prefix: 'KXMLBF7' },
  { key: 'extras', label: 'Extra Innings', prefix: 'KXMLBEXTRAS' },
];

// Basketball shares one shape for NBA and WNBA — only the league prefix differs.
function basketballBets(p: string): BetSeries[] {
  const bets: BetSeries[] = [
    { key: 'winner', label: 'Game Winner', prefix: `${p}GAME` },
    { key: 'spread', label: 'Spread', prefix: `${p}SPREAD` },
    { key: 'total', label: 'Total Points (Over/Under)', prefix: `${p}TOTAL` },
    { key: 'teamtotal', label: 'Team Total Points', prefix: `${p}TEAMTOTAL` },
  ];
  const periods: Array<[string, string]> = [
    ['1H', '1st Half'],
    ['2H', '2nd Half'],
    ['1Q', '1st Quarter'],
    ['2Q', '2nd Quarter'],
    ['3Q', '3rd Quarter'],
    ['4Q', '4th Quarter'],
  ];
  for (const [code, label] of periods) {
    bets.push({ key: `${code.toLowerCase()}w`, label: `${label} — Winner`, prefix: `${p}${code}WINNER` });
    bets.push({ key: `${code.toLowerCase()}s`, label: `${label} — Spread`, prefix: `${p}${code}SPREAD` });
    bets.push({ key: `${code.toLowerCase()}t`, label: `${label} — Total`, prefix: `${p}${code}TOTAL` });
  }
  return bets;
}

export const SPORTS: Record<string, Sport> = {
  mlb: { key: 'mlb', label: 'MLB', gameSeries: 'KXMLBGAME', bets: MLB_BETS },
  wnba: { key: 'wnba', label: 'WNBA', gameSeries: 'KXWNBAGAME', bets: basketballBets('KXWNBA') },
  nba: { key: 'nba', label: 'NBA', gameSeries: 'KXNBAGAME', bets: basketballBets('KXNBA') },
};

// Display order — in-season sports first.
export const SPORT_ORDER = ['mlb', 'wnba', 'nba'];
