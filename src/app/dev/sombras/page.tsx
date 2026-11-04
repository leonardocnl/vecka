import { notFound } from "next/navigation";

// Só no desenvolvimento: as três elevações do Relevo (docs/design.md) nas peças de verdade, os dois
// temas lado a lado, para conferir a luz única e a borda de luz nos cantos. Em produção é 404.

function Samples() {
    return (
        <>
            <p className="dev-label">Apoiada: placa, painel, teclas</p>
            <div className="card dev-stack">
                <div className="dev-row">
                    <button type="button" className="key-light">
                        Semana
                    </button>
                    <button type="button" className="key-sm">
                        Editar
                    </button>
                    <button type="button" className="knob" aria-label="Ajustes" />
                </div>
                <div className="sheet-actions">
                    <button type="button">Cancelar</button>
                    <button type="button" className="save">
                        Salvar
                    </button>
                </div>
                <p className="dev-label">Afundada: escolhido, campo, campo focado</p>
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
                <input className="field" aria-label="Campo" defaultValue="Dentista" />
                <input
                    className="field dev-focus"
                    aria-label="Campo focado"
                    defaultValue="Dentista"
                />
            </div>
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
            <p className="dev-label">Flutuante: barra, folha, ajustes, desfazer</p>
            <div className="dev-float">Folha, ajustes</div>
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
