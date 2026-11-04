// Grão de papel por cima do fundo (docs/design.md, "Textura"): um para o claro, outro para o
// escuro; o CSS mostra só o do tema atual.
export function Grain() {
    return (
        <>
            <svg className="grain day" aria-hidden="true">
                <filter id="grain-day">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.9"
                        numOctaves="3"
                        stitchTiles="stitch"
                    />
                    <feColorMatrix
                        type="matrix"
                        values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.3  0 0 0 0.22 0"
                    />
                </filter>
                <rect width="100%" height="100%" filter="url(#grain-day)" />
            </svg>
            <svg className="grain night" aria-hidden="true">
                <filter id="grain-night">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.9"
                        numOctaves="3"
                        stitchTiles="stitch"
                    />
                    <feColorMatrix
                        type="matrix"
                        values="0 0 0 0 0.6  0 0 0 0 0.58  0 0 0 0 0.54  0 0 0 0.12 0"
                    />
                </filter>
                <rect width="100%" height="100%" filter="url(#grain-night)" />
            </svg>
        </>
    );
}
