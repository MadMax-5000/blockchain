# Rapports LaTeX

Deux rapports indépendants, en français :

- `devoir1.tex` / `devoir1.pdf` — registre `CertificateRegistry` ;
- `devoir2.tex` / `devoir2.pdf` — migration ERC-721 et audit.

Compilation (deux passages pour les références croisées) :

```bash
pdflatex devoir1.tex && pdflatex devoir1.tex
pdflatex devoir2.tex && pdflatex devoir2.tex
```

Les captures viennent de `../screenshots/`. Les fichiers `.aux` et `.log` sont
ignorés par Git.
