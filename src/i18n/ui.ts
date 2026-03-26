export const locales = ['ja', 'en'] as const;
export type Locale = typeof locales[number];

export const ui = {
  ja: {
    'nav.lang': 'English',
    'site.description': 'raigaのポートフォリオサイト',
    'blog.title': 'Blog | a6x.dev',
    'blog.description': 'raigaのブログ記事一覧',
    'slides.title': 'Slides | a6x.dev',
    'slides.description': 'raigaのスライド一覧',
    'products.title': 'Products | a6x.dev',
    'products.description': 'raigaの制作物一覧',
    'blog.empty': '記事はまだありません。',
    'slides.empty': 'スライドはまだありません。',
    'products.empty': '制作物はまだありません。',
    'rss.label': 'RSS フィード',
    'slides.back': '← Slides',
    'slides.viewon': 'SpeakerDeck で見る →',
    'products.back': '← Products',
    '404.message': 'ページが見つかりませんでした。',
    '404.back': '← ホームに戻る',
    'date.locale': 'ja-JP',
    'books.title': 'Books | a6x.dev',
    'books.description': '技術書・解説まとめ',
    'books.empty': '本はまだありません。',
    'books.lead': '技術的なトピックを章立てでまとめた読み物です。',
    'books.back': '← Books',
    'books.start': '最初のチャプターを読む →',
    'books.toc': '目次',
    'chapter.prev': '前のチャプター',
    'chapter.next': '次のチャプター',
  },
  en: {
    'nav.lang': '日本語',
    'site.description': 'Portfolio site of raiga, software engineer.',
    'blog.title': 'Blog | a6x.dev',
    'blog.description': 'Blog posts by raiga',
    'slides.title': 'Slides | a6x.dev',
    'slides.description': 'Slides by raiga',
    'products.title': 'Products | a6x.dev',
    'products.description': 'Products by raiga',
    'blog.empty': 'No posts yet.',
    'slides.empty': 'No slides yet.',
    'products.empty': 'No products yet.',
    'rss.label': 'RSS feed',
    'slides.back': '← Slides',
    'slides.viewon': 'View on SpeakerDeck →',
    'products.back': '← Products',
    '404.message': 'Page not found.',
    '404.back': '← Back to Home',
    'date.locale': 'en-US',
    'books.title': 'Books | a6x.dev',
    'books.description': 'Technical books and guides',
    'books.empty': 'No books yet.',
    'books.lead': 'In-depth technical write-ups organized into chapters.',
    'books.back': '← Books',
    'books.start': 'Start reading →',
    'books.toc': 'Table of Contents',
    'chapter.prev': 'Previous',
    'chapter.next': 'Next',
  },
} as const;

export type UIKey = keyof typeof ui['ja'];

export function useTranslations(locale: Locale) {
  return (key: UIKey): string => ui[locale][key] ?? ui['ja'][key];
}
