import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://vwciwaekgmncgwnocygm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Y2l3YWVrZ21uY2d3bm9jeWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNDQwODQsImV4cCI6MjEwNDkyMDA4NH0.GCAkNBJMrXemJz5excsdkRsQbSSUbjWNHC4azOBNKKM'
const supabase = createClient(supabaseUrl, supabaseKey)

async function obtenerEstudiantes() {
  const { data, error } = await supabase
    .from('estudiantes')
    .select('*')

  if (error) {
    console.error('Error al consultar estudiantes:', error.message)
    return
  }

  if (!data || data.length === 0) {
    console.log('La tabla estudiantes no contiene registros.')
    return
  }

  console.table(data)
}

obtenerEstudiantes()