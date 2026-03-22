export const CATEGORIES: Record<string, string> = {
  BOOKS: "Books",
  BUSINESS: "Business",
  DEVELOPER_TOOLS: "Developer tools",
  EDUCATION: "Education",
  ENTERTAINMENT: "Entertainment",
  FINANCE: "Finance",
  FOOD_AND_DRINK: "Food & drink",
  GAMES: "Games",
  GRAPHICS_AND_DESIGN: "Graphics & design",
  HEALTH_AND_FITNESS: "Health & fitness",
  LIFESTYLE: "Lifestyle",
  MAGAZINES_AND_NEWSPAPERS: "Magazines & newspapers",
  MEDICAL: "Medical",
  MUSIC: "Music",
  NAVIGATION: "Navigation",
  NEWS: "News",
  PHOTO_AND_VIDEO: "Photo & video",
  PRODUCTIVITY: "Productivity",
  REFERENCE: "Reference",
  SHOPPING: "Shopping",
  SOCIAL_NETWORKING: "Social networking",
  SPORTS: "Sports",
  STICKERS: "Stickers",
  TRAVEL: "Travel",
  UTILITIES: "Utilities",
  WEATHER: "Weather",
};

export function categoryName(id: string): string {
  return CATEGORIES[id] ?? id;
}
