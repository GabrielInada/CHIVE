import { axisBottom, axisLeft, extent, max, scaleBand, scaleLinear, select } from 'd3';
import { calcularEstatisticas } from '../services/dataService.js';
import { t, obterLocale } from '../services/i18nService.js';

function traduzirTipo(tipo) {
if (tipo === 'numero') return t('chive-type-number');
if (tipo === 'texto') return t('chive-type-text');
return tipo;
}

function escaparHTML(texto) {
return String(texto)
.replaceAll('&', '&amp;')
.replaceAll('<', '&lt;')
.replaceAll('>', '&gt;')
.replaceAll('"', '&quot;')
.replaceAll("'", '&#39;');
}

function mensagemChart(containerId, mensagem) {
const container = document.getElementById(containerId);
container.innerHTML = `<div class="chart-vazio">${mensagem}</div>`;
}

function desenharBarra(dados, colunaCategoria) {
if (!colunaCategoria) {
mensagemChart('chart-bar-container', t('chive-chart-empty-bar'));
return;
}

const contador = new Map();
dados.forEach(linha => {
const valorBruto = linha[colunaCategoria];
const categoria = valorBruto === null || valorBruto === undefined || valorBruto === ''
? '—'
: String(valorBruto);
contador.set(categoria, (contador.get(categoria) || 0) + 1);
});

const linhas = Array.from(contador.entries()).sort((a, b) => b[1] - a[1]);
if (linhas.length === 0) {
mensagemChart('chart-bar-container', t('chive-chart-no-data'));
return;
}

const container = document.getElementById('chart-bar-container');
container.innerHTML = '';

const largura = Math.max(container.clientWidth || 700, 320);
const altura = 320;
const margem = { top: 12, right: 12, bottom: 90, left: 52 };
const larguraInterna = largura - margem.left - margem.right;
const alturaInterna = altura - margem.top - margem.bottom;

const svg = select(container)
.append('svg')
.attr('width', largura)
.attr('height', altura);

const grupo = svg
.append('g')
.attr('transform', `translate(${margem.left},${margem.top})`);

const escalaX = scaleBand()
.domain(linhas.map(item => item[0]))
.range([0, larguraInterna])
.padding(0.14);

const escalaY = scaleLinear()
.domain([0, max(linhas, item => item[1]) || 0])
.nice()
.range([alturaInterna, 0]);

grupo
.selectAll('rect')
.data(linhas)
.enter()
.append('rect')
.attr('x', item => escalaX(item[0]))
.attr('y', item => escalaY(item[1]))
.attr('width', escalaX.bandwidth())
.attr('height', item => alturaInterna - escalaY(item[1]))
.attr('rx', 3)
.attr('fill', '#d4622a');

grupo
.append('g')
.attr('transform', `translate(0,${alturaInterna})`)
.call(axisBottom(escalaX))
.selectAll('text')
.style('text-anchor', 'end')
.attr('dx', '-0.6em')
.attr('dy', '0.15em')
.attr('transform', 'rotate(-30)');

grupo
.append('g')
.call(axisLeft(escalaY).ticks(6));
}

function normalizarDominio([minimo, maximo]) {
if (!Number.isFinite(minimo) || !Number.isFinite(maximo)) return [0, 1];
if (minimo === maximo) {
const delta = minimo === 0 ? 1 : Math.abs(minimo * 0.1);
return [minimo - delta, maximo + delta];
}
return [minimo, maximo];
}

function desenharDispersao(dados, eixoX, eixoY) {
if (!eixoX || !eixoY) {
mensagemChart('chart-scatter-container', t('chive-chart-empty-scatter'));
return;
}

const pontos = dados
.map(linha => ({ x: Number(linha[eixoX]), y: Number(linha[eixoY]) }))
.filter(ponto => Number.isFinite(ponto.x) && Number.isFinite(ponto.y));

if (pontos.length === 0) {
mensagemChart('chart-scatter-container', t('chive-chart-no-data'));
return;
}

const container = document.getElementById('chart-scatter-container');
container.innerHTML = '';

const largura = Math.max(container.clientWidth || 700, 320);
const altura = 320;
const margem = { top: 12, right: 12, bottom: 44, left: 52 };
const larguraInterna = largura - margem.left - margem.right;
const alturaInterna = altura - margem.top - margem.bottom;

const svg = select(container)
.append('svg')
.attr('width', largura)
.attr('height', altura);

const grupo = svg
.append('g')
.attr('transform', `translate(${margem.left},${margem.top})`);

const dominioX = normalizarDominio(extent(pontos, ponto => ponto.x));
const dominioY = normalizarDominio(extent(pontos, ponto => ponto.y));

const escalaX = scaleLinear().domain(dominioX).nice().range([0, larguraInterna]);
const escalaY = scaleLinear().domain(dominioY).nice().range([alturaInterna, 0]);

grupo
.selectAll('circle')
.data(pontos)
.enter()
.append('circle')
.attr('cx', ponto => escalaX(ponto.x))
.attr('cy', ponto => escalaY(ponto.y))
.attr('r', 2.8)
.attr('fill', '#1a472a')
.attr('opacity', 0.72);

grupo
.append('g')
.attr('transform', `translate(0,${alturaInterna})`)
.call(axisBottom(escalaX).ticks(8));

grupo
.append('g')
.call(axisLeft(escalaY).ticks(8));
}

export function formatarNumero(valor) {
const numero = Number(valor);
if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) return '—';
const locale = obterLocale();
if (Number.isInteger(numero)) return numero.toLocaleString(locale);
if (Math.abs(numero) >= 100) return numero.toLocaleString(locale, { maximumFractionDigits: 1 });
if (Math.abs(numero) >= 1) return numero.toLocaleString(locale, { maximumFractionDigits: 2 });

return numero.toPrecision(4);
}

export function mostrarErro(mensagem) {
const elemento = document.getElementById('mensagem-erro');
elemento.textContent = '⚠ ' + mensagem;
elemento.style.display = 'block';
}

export function esconderErro() {
document.getElementById('mensagem-erro').style.display = 'none';
}

export function renderizarListaArquivos(datasets, indiceAtivo, aoSelecionar, aoRemover) {
const infoArquivo = document.getElementById('info-arquivo');
const resumo = document.getElementById('arquivo-resumo-texto');
const lista = document.getElementById('lista-arquivos-conteudo');

infoArquivo.style.display = 'block';
resumo.textContent = t('chive-files-loaded', datasets.length);

lista.innerHTML = datasets.map((dataset, indice) => `
<div class="arquivo-item ${indice === indiceAtivo ? 'ativo' : ''}" data-idx="${indice}">
<button class="arquivo-item-botao" type="button" data-acao="selecionar" data-idx="${indice}">
<span class="arquivo-item-nome" title="${escaparHTML(dataset.nome)}">${escaparHTML(dataset.nome)}</span>
<span class="arquivo-item-meta">${t('chive-file-meta', dataset.dados.length.toLocaleString(obterLocale()), dataset.colunas.length, dataset.tamanho)}</span>
</button>
<button class="arquivo-item-remover" type="button" data-acao="remover" data-idx="${indice}" aria-label="${escaparHTML(t('chive-remove-file', dataset.nome))}">×</button>
</div>
`).join('');

lista.onclick = evento => {
const alvo = evento.target.closest('[data-acao]');
if (!alvo) return;

const indice = Number(alvo.dataset.idx);
if (Number.isNaN(indice)) return;

if (alvo.dataset.acao === 'remover') {
aoRemover(indice);
return;
}

aoSelecionar(indice);
};
}

export function renderizarEstadoVazio() {
document.getElementById('info-arquivo').style.display = 'none';
document.getElementById('painel-colunas').style.display = 'none';
document.getElementById('estado-vazio').style.display = 'flex';
document.getElementById('estado-dados').style.display = 'none';
document.getElementById('resultado-tabs').style.display = 'none';
document.getElementById('container-tabela').innerHTML = '';
document.getElementById('container-stats').innerHTML = '';
document.getElementById('chart-bar-container').innerHTML = '';
document.getElementById('chart-scatter-container').innerHTML = '';
document.getElementById('charts-controles').innerHTML = '';
document.getElementById('badge-charts').textContent = '—';
document.getElementById('btn-avancar').disabled = true;
document.getElementById('aviso-dev').style.display = 'none';
document.getElementById('zona-upload').classList.remove('carregado');
document.querySelector('.upload-icone').textContent = '⬆';
document.querySelector('.upload-texto-principal').textContent = t('chive-upload-main');
document.querySelector('.upload-texto-sub').innerHTML = t('chive-upload-sub');
}

export function renderizarInterface(
dados,
colunas,
nomeArquivo,
tamanhoArquivo,
linhasPreview = 10,
colunasSelecionadas = null,
aoAlterarSelecaoColuna = null,
configGraficos = null,
aoAlterarConfigGraficos = null
) {
document.getElementById('painel-colunas').style.display = 'block';
document.getElementById('resultado-tabs').style.display = 'flex';

const nomesColunas = colunas.map(coluna => coluna.nome);
const nomesSelecionados = new Set(
Array.isArray(colunasSelecionadas)
? colunasSelecionadas
: nomesColunas
);
const colunasVisiveis = colunas.filter(coluna => nomesSelecionados.has(coluna.nome));
const colunasNumericasVisiveis = colunasVisiveis.filter(coluna => coluna.tipo === 'numero');
const colunasCategoriaVisiveis = colunasVisiveis.filter(coluna => coluna.tipo !== 'numero');
const opcoesBarra = colunasCategoriaVisiveis.length > 0
? colunasCategoriaVisiveis
: colunasVisiveis;

const config = {
aba: configGraficos?.aba === 'charts' ? 'charts' : 'preview',
barCategoria: opcoesBarra.some(col => col.nome === configGraficos?.barCategoria)
? configGraficos.barCategoria
: (opcoesBarra[0]?.nome ?? null),
scatterX: colunasNumericasVisiveis.some(col => col.nome === configGraficos?.scatterX)
? configGraficos.scatterX
: (colunasNumericasVisiveis[0]?.nome ?? null),
scatterY: colunasNumericasVisiveis.some(col => col.nome === configGraficos?.scatterY)
? configGraficos.scatterY
: (colunasNumericasVisiveis[1]?.nome ?? colunasNumericasVisiveis[0]?.nome ?? null),
};

const listaColunas = document.getElementById('lista-colunas-conteudo');
listaColunas.innerHTML = `
<div class="colunas-acoes" aria-label="${t('chive-section-columns')}">
<button class="colunas-acao" type="button" data-acao-coluna="todas">${t('chive-action-select-all')}</button>
<button class="colunas-acao" type="button" data-acao-coluna="limpar">${t('chive-action-clear')}</button>
<button class="colunas-acao" type="button" data-acao-coluna="numericas">${t('chive-action-only-numeric')}</button>
<button class="colunas-acao" type="button" data-acao-coluna="texto">${t('chive-action-only-text')}</button>
</div>
` + colunas.map(({ nome, tipo }) => `
<label class="coluna-item" title="${escaparHTML(nome)}">
<input class="coluna-checkbox" type="checkbox" data-coluna="${escaparHTML(nome)}" ${nomesSelecionados.has(nome) ? 'checked' : ''} />
<span class="coluna-nome">${escaparHTML(nome)}</span>
<span class="tipo-tag ${tipo}">${traduzirTipo(tipo)}</span>
</label>
`).join('');

listaColunas.onclick = evento => {
const alvo = evento.target.closest('[data-acao-coluna]');
if (!alvo || !aoAlterarSelecaoColuna) return;

const acao = alvo.dataset.acaoColuna;
if (acao === 'todas') {
aoAlterarSelecaoColuna(nomesColunas);
return;
}

if (acao === 'limpar') {
aoAlterarSelecaoColuna([]);
return;
}

if (acao === 'numericas') {
aoAlterarSelecaoColuna(
colunas.filter(coluna => coluna.tipo === 'numero').map(coluna => coluna.nome)
);
return;
}

if (acao === 'texto') {
aoAlterarSelecaoColuna(
colunas.filter(coluna => coluna.tipo === 'texto').map(coluna => coluna.nome)
);
}
};

listaColunas.onchange = evento => {
const alvo = evento.target;
if (!(alvo instanceof HTMLInputElement) || alvo.type !== 'checkbox' || !aoAlterarSelecaoColuna) return;

const selecionados = Array.from(listaColunas.querySelectorAll('.coluna-checkbox:checked'))
.map(checkbox => checkbox.dataset.coluna)
.filter(Boolean);

aoAlterarSelecaoColuna(selecionados);
};

document.getElementById('estado-vazio').style.display = 'none';
const estadoDados = document.getElementById('estado-dados');
estadoDados.style.display = 'flex';

const tabPreview = document.getElementById('tab-preview');
const tabCharts = document.getElementById('tab-charts');
const painelPreview = document.getElementById('painel-preview');
const painelCharts = document.getElementById('painel-charts');
const previewAtivo = config.aba === 'preview';

tabPreview.classList.toggle('ativo', previewAtivo);
tabCharts.classList.toggle('ativo', !previewAtivo);
painelPreview.classList.toggle('ativo', previewAtivo);
painelCharts.classList.toggle('ativo', !previewAtivo);

tabPreview.onclick = () => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'preview' });
};

tabCharts.onclick = () => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'charts' });
};

const limite = Number(linhasPreview) > 0 ? Number(linhasPreview) : 10;

document.getElementById('badge-linhas').textContent = t(
'chive-badge-preview',
dados.length.toLocaleString(obterLocale()),
Math.min(limite, dados.length),
colunasVisiveis.length,
colunas.length
);

const linhasPreviewDados = dados.slice(0, limite);

const cabecalhoHTML = colunasVisiveis.map(({ nome, tipo }) =>
`<th class="${tipo === 'numero' ? 'num' : ''}">${nome}</th>`
).join('');

const corpoHTML = linhasPreviewDados.map(linha =>
'<tr>' + colunasVisiveis.map(({ nome, tipo }) => {
const val = linha[nome];
const exibir = val === null || val === undefined || val === ''
? '—'
: tipo === 'numero'
? formatarNumero(val)
: String(val);

return `<td class="${tipo === 'numero' ? 'num' : ''}">${exibir}</td>`;
}).join('') + '</tr>'
).join('');

if (colunasVisiveis.length === 0) {
document.getElementById('container-tabela').innerHTML =
`<div class="tabela-sem-colunas">${t('chive-no-columns-selected')}</div>`;
} else {
const rodapeHTML = colunasVisiveis.map(({ tipo }) => `<td>${traduzirTipo(tipo)}</td>`).join('');

document.getElementById('container-tabela').innerHTML = `
<table class="tabela-preview">
<thead><tr>${cabecalhoHTML}</tr></thead>
<tbody>${corpoHTML}</tbody>
<tfoot><tr>${rodapeHTML}</tr></tfoot>
</table>
`;
}

const stats = calcularEstatisticas(dados, colunasVisiveis);
const cardStats = document.getElementById('card-stats');

if (stats.length > 0) {
cardStats.style.display = 'block';
document.getElementById('badge-num-colunas').textContent = t('chive-stats-badge', stats.length);

document.getElementById('container-stats').innerHTML = stats.map(stat => `
<div class="stat-col">
<div class="stat-col-nome" title="${escaparHTML(stat.nome)}">${escaparHTML(stat.nome)}</div>
<div class="stat-linha"><span>${t('chive-stat-valid')}</span> <span>${stat.n.toLocaleString(obterLocale())}</span></div>
<div class="stat-linha"><span>${t('chive-stat-min')}</span> <span>${formatarNumero(stat.min)}</span></div>
<div class="stat-linha"><span>${t('chive-stat-max')}</span> <span>${formatarNumero(stat.max)}</span></div>
<div class="stat-linha"><span>${t('chive-stat-mean')}</span> <span>${formatarNumero(stat.media)}</span></div>
<div class="stat-linha"><span>${t('chive-stat-median')}</span> <span>${formatarNumero(stat.mediana)}</span></div>
</div>
`).join('');
} else {
cardStats.style.display = 'none';
document.getElementById('container-stats').innerHTML = '';
}

document.getElementById('badge-charts').textContent = t(
'chive-charts-badge',
colunasVisiveis.length,
colunasNumericasVisiveis.length
);

const controles = document.getElementById('charts-controles');
controles.innerHTML = `
<div class="chart-controle">
<label for="chart-select-bar">${t('chive-chart-control-bar-category')}</label>
<select id="chart-select-bar" class="linhas-select">
<option value="">${t('chive-chart-option-none')}</option>
${opcoesBarra.map(coluna => `<option value="${escaparHTML(coluna.nome)}" ${coluna.nome === config.barCategoria ? 'selected' : ''}>${escaparHTML(coluna.nome)}</option>`).join('')}
</select>
</div>
<div class="chart-controle">
<label for="chart-select-x">${t('chive-chart-control-scatter-x')}</label>
<select id="chart-select-x" class="linhas-select">
<option value="">${t('chive-chart-option-none')}</option>
${colunasNumericasVisiveis.map(coluna => `<option value="${escaparHTML(coluna.nome)}" ${coluna.nome === config.scatterX ? 'selected' : ''}>${escaparHTML(coluna.nome)}</option>`).join('')}
</select>
</div>
<div class="chart-controle">
<label for="chart-select-y">${t('chive-chart-control-scatter-y')}</label>
<select id="chart-select-y" class="linhas-select">
<option value="">${t('chive-chart-option-none')}</option>
${colunasNumericasVisiveis.map(coluna => `<option value="${escaparHTML(coluna.nome)}" ${coluna.nome === config.scatterY ? 'selected' : ''}>${escaparHTML(coluna.nome)}</option>`).join('')}
</select>
</div>
`;

const selectBar = document.getElementById('chart-select-bar');
const selectX = document.getElementById('chart-select-x');
const selectY = document.getElementById('chart-select-y');

selectBar.onchange = evento => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'charts', barCategoria: evento.target.value || null });
};

selectX.onchange = evento => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'charts', scatterX: evento.target.value || null });
};

selectY.onchange = evento => {
if (!aoAlterarConfigGraficos) return;
aoAlterarConfigGraficos({ ...config, aba: 'charts', scatterY: evento.target.value || null });
};

if (config.aba === 'charts') {
desenharBarra(dados, config.barCategoria);
desenharDispersao(dados, config.scatterX, config.scatterY);
}

document.getElementById('btn-avancar').disabled = false;
document.getElementById('aviso-dev').style.display = 'block';
document.getElementById('zona-upload').classList.add('carregado');
document.querySelector('.upload-icone').textContent = '✓';
document.querySelector('.upload-texto-principal').textContent = t('chive-upload-loaded-main');
document.querySelector('.upload-texto-sub').textContent = t('chive-upload-loaded-sub');
document.getElementById('arquivo-resumo-texto').title =
`${nomeArquivo} · ${dados.length.toLocaleString(obterLocale())} linhas · ${colunas.length} colunas · ${tamanhoArquivo}`;
}
