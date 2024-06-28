export const runtime = 'edge'

export default async function GET() {
  return new Response('Hello, Next.js!', {
    status: 200,
  })
}
