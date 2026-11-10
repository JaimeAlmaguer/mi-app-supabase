const SUPABASE_URL = 'https://vwciwaekgmncgwnocygm.supabase.co'

class Entidad {
  constructor(datos = {}) {
    Object.assign(this, datos)
  }
}

class Empleado extends Entidad {}
class Departamento extends Entidad {}
class Puesto extends Entidad {}
class Nomina extends Entidad {}
class Vacacion extends Entidad {}
class Asistencia extends Entidad {}

class SupabaseRepository {
  constructor(cliente, tabla, EntidadModelo) {
    this.cliente = cliente
    this.tabla = tabla
    this.EntidadModelo = EntidadModelo
  }

  async listar() {
    const { data, error } = await this.cliente.from(this.tabla).select('*')
    if (error) throw new Error(`${this.tabla}: ${error.message}`)
    return (data || []).map((registro) => new this.EntidadModelo(registro))
  }
}

class RecursosHumanosService {
  constructor(cliente) {
    this.repositorios = {
      empleados: new SupabaseRepository(cliente, 'empleados', Empleado),
      nomina: new SupabaseRepository(cliente, 'nomina', Nomina),
      vacaciones: new SupabaseRepository(cliente, 'vacaciones', Vacacion),
      asistencias: new SupabaseRepository(cliente, 'asistencias', Asistencia),
      departamentos: new SupabaseRepository(cliente, 'departamentos', Departamento),
      puestos: new SupabaseRepository(cliente, 'puestos', Puesto),
    }
  }

  consultar(modulo) {
    const repositorio = this.repositorios[modulo]
    if (!repositorio) throw new Error(`Módulo desconocido: ${modulo}`)
    return repositorio.listar()
  }

  async resumen() {
    const datos = {}
    const errores = {}
    const consultas = Object.entries(this.repositorios).map(async ([modulo, repositorio]) => {
      try {
        datos[modulo] = await repositorio.listar()
      } catch (error) {
        errores[modulo] = error.message
        datos[modulo] = []
      }
    })
    await Promise.all(consultas)
    return { datos, errores }
  }
}

const MODULOS = [
  { id: 'empleados', label: 'Empleados', icon: '▦' },
  { id: 'nomina', label: 'Nómina', icon: '$' },
  { id: 'vacaciones', label: 'Vacaciones', icon: '☼' },
  { id: 'asistencias', label: 'Asistencias', icon: '✓' },
  { id: 'departamentos', label: 'Departamentos', icon: '⌘' },
  { id: 'puestos', label: 'Puestos', icon: '◆' },
]

const estado = { modulo: 'empleados', registros: [], resumen: {} }
const elementos = {
  navigation: document.querySelector('#module-navigation'),
  metrics: document.querySelector('#metric-grid'),
  title: document.querySelector('#results-title'),
  count: document.querySelector('#result-count'),
  search: document.querySelector('#search-input'),
  head: document.querySelector('#table-head'),
  list: document.querySelector('#results-list'),
  status: document.querySelector('#status-card'),
  statusMessage: document.querySelector('#status-message'),
  refresh: document.querySelector('#refresh-button'),
  connectionDot: document.querySelector('#connection-dot'),
  connectionLabel: document.querySelector('#connection-label'),
}

function escaparHtml(valor) {
  return String(valor ?? '—')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function nombreColumna(columna) {
  return columna.replace(/_/g, ' ').replace(/\b\w/g, (letra) => letra.toUpperCase())
}

function establecerEstado(mensaje, tipo = '') {
  elementos.status.className = `status-card ${tipo}`.trim()
  elementos.statusMessage.textContent = mensaje
}

function columnasDe(registros) {
  return registros.length ? Object.keys(registros[0]) : []
}

function renderizarTabla() {
  const consulta = elementos.search.value.trim().toLowerCase()
  const filtrados = estado.registros.filter((registro) =>
    Object.values(registro).some((valor) => String(valor ?? '').toLowerCase().includes(consulta)))
  const columnas = columnasDe(estado.registros)
  elementos.head.innerHTML = columnas.map((columna) => `<th scope="col">${nombreColumna(columna)}</th>`).join('')
  elementos.count.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'registro' : 'registros'}`
  if (!filtrados.length) {
    elementos.list.innerHTML = `<tr><td class="table-message" colspan="${Math.max(columnas.length, 1)}">${consulta ? 'No hay coincidencias.' : 'No hay registros en esta tabla.'}</td></tr>`
    return
  }
  elementos.list.innerHTML = filtrados.map((registro) =>
    `<tr>${columnas.map((columna) => `<td>${escaparHtml(registro[columna])}</td>`).join('')}</tr>`).join('')
}

function renderizarMetricas() {
  elementos.metrics.innerHTML = MODULOS.slice(0, 4).map((modulo) => `
    <article class="metric-card">
      <span class="metric-icon">${modulo.icon}</span>
      <div><p>${modulo.label}</p><strong>${estado.resumen[modulo.id]?.length ?? '—'}</strong></div>
    </article>`).join('')
}

function seleccionarModulo(modulo) {
  estado.modulo = modulo
  estado.registros = estado.resumen[modulo] || []
  elementos.title.textContent = MODULOS.find((item) => item.id === modulo).label
  elementos.search.value = ''
  document.querySelectorAll('.nav-link').forEach((enlace) =>
    enlace.classList.toggle('active', enlace.dataset.module === modulo))
  renderizarTabla()
}

function renderizarNavegacion() {
  elementos.navigation.innerHTML = MODULOS.map((modulo) =>
    `<button class="nav-link ${modulo.id === estado.modulo ? 'active' : ''}" data-module="${modulo.id}" type="button">
      <span aria-hidden="true">${modulo.icon}</span>${modulo.label}</button>`).join('')
  elementos.navigation.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-module]')
    if (boton) seleccionarModulo(boton.dataset.module)
  })
}

async function cargarDatos() {
  elementos.refresh.disabled = true
  establecerEstado('Consultando módulos en Supabase…')
  const clave = globalThis.SUPABASE_ANON_KEY
  if (!clave || clave === '******' || !globalThis.supabase) {
    establecerEstado('Configura una clave anon válida para consultar Supabase.', 'error')
    elementos.connectionLabel.textContent = 'Sin configurar'
    elementos.connectionDot.classList.add('offline')
    elementos.refresh.disabled = false
    return
  }
  try {
    const cliente = globalThis.supabase.createClient(SUPABASE_URL, clave)
    const servicio = new RecursosHumanosService(cliente)
    const resultado = await servicio.resumen()
    estado.resumen = resultado.datos
    seleccionarModulo(estado.modulo)
    renderizarMetricas()
    const modulosConError = Object.keys(resultado.errores)
    if (modulosConError.length) {
      establecerEstado(`Conectado, pero ${modulosConError.length} módulo(s) no pudieron consultarse. Revisa tablas y políticas RLS.`, 'warning')
    } else {
      establecerEstado('Conectado a Supabase. Los datos están actualizados.', 'success')
    }
    elementos.connectionLabel.textContent = 'Conectado'
    elementos.connectionDot.classList.remove('offline')
  } catch (error) {
    establecerEstado(`No se pudo cargar la información: ${error.message}`, 'error')
    elementos.connectionLabel.textContent = 'Error de conexión'
    elementos.connectionDot.classList.add('offline')
  } finally {
    elementos.refresh.disabled = false
  }
}

renderizarNavegacion()
elementos.search.addEventListener('input', renderizarTabla)
elementos.refresh.addEventListener('click', cargarDatos)
cargarDatos()
