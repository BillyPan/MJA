
import { Instructor, Tile, TileType } from './types';

// Use GitHub raw content URLs for the instructor images
const getGitHubUrl = (id: number) => `https://raw.githubusercontent.com/BillyPan/MJA2/main/mj${id}.jpg`;

export const INSTRUCTORS: Instructor[] = [
  { id: 1, name: "美雪老師", avatar: getGitHubUrl(1), prompt: "A beautiful young Japanese female PE teacher, athletic build, track suit, school background, anime style, high quality", description: "體育老師，擅長速攻。", difficulty: 1, specialSkillChance: 0.018, maxSkillUses: 1 },
  { id: 2, name: "麗奈老師", avatar: getGitHubUrl(2), prompt: "A beautiful young Japanese female music teacher, elegant, holding a baton, piano room background, anime style, high quality", description: "音樂老師，喜好高貴的牌型。", difficulty: 2, specialSkillChance: 0.019, maxSkillUses: 1 },
  { id: 3, name: "靜香主任", avatar: getGitHubUrl(3), prompt: "A beautiful young Japanese female school dean, strict look with glasses, office background, anime style, high quality", description: "嚴格的教導主任，守備力極強。", difficulty: 3, specialSkillChance: 0.02, maxSkillUses: 1 },
  { id: 4, name: "優子老師", avatar: getGitHubUrl(4), prompt: "A beautiful young Japanese female librarian teacher, gentle, holding a book, library background, anime style, high quality", description: "圖書館管理員，運氣深不可測。", difficulty: 4, specialSkillChance: 0.022, maxSkillUses: 2 },
  { id: 5, name: "小藍老師", avatar: getGitHubUrl(5), prompt: "A beautiful young Japanese female art teacher, creative, paint on clothes, art studio background, anime style, high quality", description: "美術老師，偏愛清一色。", difficulty: 5, specialSkillChance: 0.024, maxSkillUses: 2 },
  { id: 6, name: "佐和子老師", avatar: getGitHubUrl(6), prompt: "A beautiful young Japanese female chemistry teacher, lab coat, glasses, science lab background, anime style, high quality", description: "化學老師，擅長各種變化。", difficulty: 6, specialSkillChance: 0.025, maxSkillUses: 2 },
  { id: 7, name: "惠美院長", avatar: getGitHubUrl(7), prompt: "A beautiful young Japanese female school principal, dignified and gorgeous, traditional office, anime style, high quality", description: "學園創辦人，擁有傳說級實力。", difficulty: 7, specialSkillChance: 0.026, maxSkillUses: 3 },
  { id: 8, name: "神秘客", avatar: getGitHubUrl(8), prompt: "A beautiful young Japanese female teacher wearing a mysterious mask, dark atmosphere, anime style, high quality", description: "隱藏在陰影下的強者。", difficulty: 8, specialSkillChance: 0.028, maxSkillUses: 3 },
  { id: 9, name: "傳說中的畢業生", avatar: getGitHubUrl(9), prompt: "A legendary beautiful Japanese female student in graduation gown, glowing aura, cherry blossom background, anime style, high quality", description: "超越一切的存在。", difficulty: 9, specialSkillChance: 0.03, maxSkillUses: 3 },
];

const BASE_URL = 'https://cdn.jsdelivr.net/gh/FluffyStuff/riichi-mahjong-tiles@master/Regular/';

export const getTileImageUrl = (type: TileType, value: number): string => {
  if (type === 'm') return `${BASE_URL}Man${value}.svg`;
  if (type === 'p') return `${BASE_URL}Pin${value}.svg`;
  if (type === 's') return `${BASE_URL}Sou${value}.svg`;
  if (type === 'z') {
    const honors: Record<number, string> = {
      1: 'Ton',   // 東
      2: 'Nan',   // 南
      3: 'Shaa',  // 西
      4: 'Pei',   // 北
      5: 'Haku',  // 白
      6: 'Hatsu', // 發
      7: 'Chun'   // 中
    };
    return `${BASE_URL}${honors[value]}.svg`;
  }
  return '';
};

export const createDeck = (): Tile[] => {
  const deck: Tile[] = [];
  const types: TileType[] = ['m', 'p', 's'];
  types.forEach(type => {
    for (let v = 1; v <= 9; v++) {
      for (let i = 0; i < 4; i++) {
        deck.push({ id: `${type}${v}-${i}`, type, value: v });
      }
    }
  });
  for (let v = 1; v <= 7; v++) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: `z${v}-${i}`, type: 'z', value: v });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};
