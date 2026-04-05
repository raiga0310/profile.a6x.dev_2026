import { getCollection, type CollectionEntry } from 'astro:content';
import { isBookIndex, isLocale, toBookSlug, toChapterSlug, type Locale } from '../i18n';

export type BookEntry = CollectionEntry<'books'>;
export type ChapterEntry = CollectionEntry<'chapters'>;

export interface BookChapterMeta {
  entry: ChapterEntry;
  slug: string;
  title: string;
  order?: number;
  description?: string;
}

export interface LocalizedBook {
  book: BookEntry;
  bookSlug: string;
  chapters: BookChapterMeta[];
}

export async function getLocalizedBooks(locale: Locale): Promise<LocalizedBook[]> {
  const [books, chapters] = await Promise.all([
    getCollection('books', book => !book.data.draft && isLocale(book.id, locale)),
    getCollection('chapters', chapter => !chapter.data.draft && isLocale(chapter.id, locale)),
  ]);

  return books
    .map(book => {
      const bookSlug = toBookSlug(book.id);
      const localizedChapters = chapters
        .filter(chapter => chapter.id.startsWith(`${bookSlug}/`) && !isBookIndex(chapter.id))
        .map(chapter => ({
          entry: chapter,
          slug: toChapterSlug(chapter.id, bookSlug),
          title: chapter.data.title,
          order: chapter.data.order,
          description: chapter.data.description,
        }))
        .sort(
          (a, b) =>
            (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title, locale),
        );

      return { book, bookSlug, chapters: localizedChapters };
    })
    .sort(
      (a, b) =>
        new Date(b.book.data.publishedAt).getTime() - new Date(a.book.data.publishedAt).getTime(),
    );
}
