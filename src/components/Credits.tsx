const LINKS = [
  { label: 'GitHub do projeto', href: 'https://github.com/gabrielmoreiraf/agent-arena' },
  { label: 'GitHub', href: 'https://github.com/gabrielmoreiraf' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/gabrielmoreirace/' },
];

/** Faixa de créditos no pé da tela: quem desenvolveu e onde achar */
export function Credits() {
  return (
    <div className="credits">
      <span>
        Desenvolvido por <b>Gabriel Moreira</b>
      </span>
      <nav>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label} ↗
          </a>
        ))}
      </nav>
    </div>
  );
}
