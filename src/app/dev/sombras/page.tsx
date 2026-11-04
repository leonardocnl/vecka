import { notFound } from "next/navigation";

// Só no desenvolvimento: as sombras do Relevo (docs/design.md) nas peças de verdade, os dois temas
// lado a lado, para conferir se são da mesma família. Em produção é 404.

function Samples() {
    return (
        <>
            <p className="ruler thin">PLACA</p>
            <div className="card dev-stack">
                <p className="ruler thin">KEY · KEY-DARK</p>
                <div className="dev-row">
                    <button type="button" className="key-light">
                        Semana
                    </button>
                    <button type="button" className="knob" aria-label="Ajustes" />
                </div>
                <p className="ruler thin">PRESSED</p>
                <div className="grid-keys four">
                    <button type="button" aria-pressed="false">
                        :00
                    </button>
                    <button type="button" aria-pressed="true">
                        :15
                    </button>
                    <button type="button" aria-pressed="false">
                        :30
                    </button>
                    <span className="done dev-row">
                        <span className="box" />
                    </span>
                </div>
                <p className="ruler thin">FIELD · FIELD-FOCUS</p>
                <input className="field" aria-label="Campo" defaultValue="Dentista" />
                <input
                    className="field dev-focus"
                    aria-label="Campo focado"
                    defaultValue="Dentista"
                />
                <p className="ruler thin">KEY-ACCENT</p>
                <div className="sheet-actions">
                    <button type="button">Cancelar</button>
                    <button type="button" className="save">
                        Salvar
                    </button>
                </div>
            </div>
            <p className="ruler thin">PAINEL</p>
            <div className="dial dev-stack">
                <div className="dev-row">
                    <button type="button" className="dock-key" aria-label="Tecla escura" />
                    <button type="button" className="dock-key accent" aria-label="Tecla verde" />
                    <span className="cal-day today dev-day">04</span>
                </div>
                <input
                    className="dock-field"
                    aria-label="Campo"
                    placeholder="Adicionar tarefa..."
                />
                <input
                    className="dock-field dev-focus"
                    aria-label="Campo focado"
                    defaultValue="Focado"
                />
            </div>
            <p className="ruler thin">FLOAT</p>
            <div className="dev-float">folha, ajustes</div>
        </>
    );
}

export default function DevShadows() {
    if (process.env.NODE_ENV === "production") notFound();
    return (
        <main className="dev-sheet">
            <div className="light dev-col">
                <Samples />
            </div>
            <div className="dark dev-col">
                <Samples />
            </div>
        </main>
    );
}
