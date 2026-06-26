export default function NewsCard({ article }) {
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-card">
      <div>
        <h4 className="news-card-title">{article.title}</h4>
        <p className="news-card-meta">
          {article.source?.name || 'Yahoo Finance'} · {article.publishedAt ? article.publishedAt.replace(' +0000', '') : ''}
        </p>
      </div>
    </a>
  )
}
