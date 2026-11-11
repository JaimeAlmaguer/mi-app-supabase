const SUPABASE_URL = 'https://vwciwaekgmncgwnocygm.supabase.co'

class AuthService {
  constructor(cliente) {
    this.cliente = cliente
  }

  async iniciarSesion(email, password) {
    const { data, error } = await this.cliente.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return data.user
  }

  async obtenerPerfil(usuarioId) {
    const { data, error } = await this.cliente
      .from('perfiles')
      .select('id, rol, empleado_id, nombre')
      .eq('id', usuarioId)
      .single()
    if (error) throw new Error(`No se pudo cargar el perfil: ${error.message}`)
    if (!['empleado', 'administrador'].includes(data.rol)) {
      throw new Error('El perfil no tiene un rol válido.')
    }
    return data
  }

  async cerrarSesion() {
    const { error } = await this.cliente.auth.signOut()
    if (error) throw new Error(error.message)
  }
}

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

const estado = { modulo: 'empleados', registros: [], resumen: {}, perfil: null }
const elementos = {
  loginScreen: document.querySelector('#login-screen'),
  appShell: document.querySelector('#app-shell'),
  loginForm: document.querySelector('#login-form'),
  loginEmail: document.querySelector('#login-email'),
  loginPassword: document.querySelector('#login-password'),
  loginButton: document.querySelector('#login-button'),
  loginMessage: document.querySelector('#login-message'),
  logout: document.querySelector('#logout-button'),
  userBadge: document.querySelector('#user-badge'),
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

function configurarCliente() {
  const clave = globalThis.SUPABASE_ANON_KEY
  if (!clave || clave === '******' || !globalThis.supabase) {
    throw new Error('Configura una clave anon válida para usar el inicio de sesión.')
  }
  return globalThis.supabase.createClient(SUPABASE_URL, clave)
}

function mostrarAplicacion(perfil) {
  estado.perfil = perfil
  elementos.loginScreen.classList.add('is-hidden')
  elementos.appShell.classList.remove('is-hidden')
  elementos.userBadge.textContent = `${perfil.nombre || 'Usuario'} · ${perfil.rol === 'administrador' ? 'Administrador' : 'Empleado'}`
}

function mostrarLogin(mensaje = '') {
  estado.perfil = null
  elementos.appShell.classList.add('is-hidden')
  elementos.loginScreen.classList.remove('is-hidden')
  elementos.loginMessage.textContent = mensaje
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
  try {
    const cliente = configurarCliente()
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

async function iniciarSesion(evento) {
  evento.preventDefault()
  elementos.loginButton.disabled = true
  elementos.loginMessage.textContent = ''
  try {
    const cliente = configurarCliente()
    const auth = new AuthService(cliente)
    const usuario = await auth.iniciarSesion(
      elementos.loginEmail.value.trim(),
      elementos.loginPassword.value,
    )
    const perfil = await auth.obtenerPerfil(usuario.id)
    mostrarAplicacion(perfil)
    await cargarDatos()
  } catch (error) {
    elementos.loginMessage.textContent = error.message.includes('Invalid login credentials')
      ? 'Correo o contraseña incorrectos.'
      : error.message
  } finally {
    elementos.loginButton.disabled = false
  }
}

async function cerrarSesion() {
  try {
    const cliente = configurarCliente()
    await new AuthService(cliente).cerrarSesion()
    mostrarLogin()
  } catch (error) {
    establecerEstado(`No se pudo cerrar la sesión: ${error.message}`, 'error')
  }
}

async function restaurarSesion() {
  try {
    const cliente = configurarCliente()
    const { data, error } = await cliente.auth.getSession()
    if (error) throw new Error(error.message)
    if (!data.session) return
    const perfil = await new AuthService(cliente).obtenerPerfil(data.session.user.id)
    mostrarAplicacion(perfil)
    await cargarDatos()
  } catch (error) {
    mostrarLogin(error.message)
  }
}

renderizarNavegacion()
elementos.search.addEventListener('input', renderizarTabla)
elementos.refresh.addEventListener('click', cargarDatos)
elementos.loginForm.addEventListener('submit', iniciarSesion)
elementos.logout.addEventListener('click', cerrarSesion)
mostrarLogin()
restaurarSesion()
