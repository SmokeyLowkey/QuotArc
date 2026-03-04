import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  category: string
  readTime: string
}

export interface BlogPostWithContent extends BlogPost {
  content: string
}

const BLOG_DIR = path.join(process.cwd(), 'content/blog')

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  return fs
    .readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => {
      const slug = f.replace('.mdx', '')
      const fileContent = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8')
      const { data } = matter(fileContent)
      return {
        slug,
        title: data.title ?? '',
        description: data.description ?? '',
        date: data.date ?? '',
        category: data.category ?? 'Guide',
        readTime: data.readTime ?? '5 min read',
      } as BlogPost
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPost(slug: string): BlogPostWithContent | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const fileContent = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(fileContent)

  return {
    slug,
    title: data.title ?? '',
    description: data.description ?? '',
    date: data.date ?? '',
    category: data.category ?? 'Guide',
    readTime: data.readTime ?? '5 min read',
    content,
  }
}
