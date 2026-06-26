export default function NewsCard({ article }) {
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px', marginBottom: '10px', textDecoration: 'none', color: '#fff', transition: 'borderColor 0.2s' }}
       onMouseEnter={e => e.currentTarget.style.borderColor = '#6c5ce7'} onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}>
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 6px 0', lineHeight: 1.4, color: '#fff' }}>{article.title}</h4>
        <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{article.source?.name || 'Yahoo Finance'} · {article.publishedAt ? article.publishedAt.replace(' +0000', '') : ''}</p>
      </div>
    </a>
  )
}