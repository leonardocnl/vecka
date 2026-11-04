# application

Casos de uso (ex.: "adicionar tarefa", "marcar como feita"). Orquestra o domain e depende só de interfaces, nunca de implementações concretas.
Pode importar de `domain`; não importa de `app` nem de `infrastructure`.
