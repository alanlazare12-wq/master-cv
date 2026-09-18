export const SECTION_CATALOG = [
  {id:'summary',label:'Perfil profesional',icon:'✦',kind:'core',description:'Propuesta de valor breve y relevante.'},
  {id:'experience',label:'Experiencia',icon:'▣',kind:'core',description:'Cargos, empresas, fechas y logros.'},
  {id:'education',label:'Educación',icon:'◇',kind:'core',description:'Formación académica y distinciones.'},
  {id:'skills',label:'Habilidades',icon:'⌘',kind:'core',description:'Competencias técnicas y profesionales.'},
  {id:'projects',label:'Proyectos',icon:'◫',kind:'professional',description:'Trabajo relevante, portafolio o proyectos técnicos.'},
  {id:'certifications',label:'Certificaciones',icon:'✓',kind:'professional',description:'Credenciales verificables.'},
  {id:'languages',label:'Idiomas',icon:'文',kind:'professional',description:'Idiomas y nivel de dominio.'},
  {id:'achievements',label:'Logros',icon:'★',kind:'professional',description:'Resultados destacados fuera de un puesto concreto.'},
  {id:'awards',label:'Premios',icon:'◆',kind:'professional',description:'Premios, reconocimientos y distinciones.'},
  {id:'volunteering',label:'Voluntariado',icon:'♡',kind:'professional',description:'Impacto social y experiencia voluntaria.'},
  {id:'publications',label:'Publicaciones',icon:'¶',kind:'academic',description:'Artículos, libros y publicaciones.'},
  {id:'courses',label:'Cursos',icon:'▤',kind:'professional',description:'Formación complementaria relevante.'},
  {id:'strengths',label:'Fortalezas',icon:'▲',kind:'personal',description:'Fortalezas con evidencia breve.'},
  {id:'interests',label:'Intereses',icon:'○',kind:'personal',description:'Intereses que aportan contexto profesional.'},
  {id:'references',label:'Referencias',icon:'“',kind:'professional',description:'Referencias profesionales opcionales.'},
  {id:'memberships',label:'Membresías',icon:'◎',kind:'academic',description:'Asociaciones y organizaciones profesionales.'},
  {id:'conferences',label:'Conferencias',icon:'◉',kind:'academic',description:'Ponencias y participación en eventos.'},
  {id:'patents',label:'Patentes',icon:'⌁',kind:'academic',description:'Patentes, invenciones y propiedad intelectual.'},
  {id:'training',label:'Formación técnica',icon:'△',kind:'professional',description:'Bootcamps, talleres y entrenamiento especializado.'},
  {id:'organizations',label:'Organizaciones',icon:'⬡',kind:'professional',description:'Participación en comunidades u organizaciones.'},
  {id:'extracurricular',label:'Actividades',icon:'✧',kind:'personal',description:'Actividades extracurriculares relevantes.'},
  {id:'causes',label:'Causas',icon:'∞',kind:'personal',description:'Causas y áreas de impacto personal.'},
  {id:'philosophy',label:'Filosofía',icon:'≈',kind:'personal',description:'Una idea breve sobre cómo trabajas.'},
  {id:'custom',label:'Sección personalizada',icon:'＋',kind:'custom',description:'Crea una sección con tu propio nombre y contenido.'}
];

export const CORE_ORDER = ['summary','experience','education','skills','projects','certifications','languages'];
export const OPTIONAL_ORDER = SECTION_CATALOG.map(x=>x.id).filter(id=>!CORE_ORDER.includes(id) && id!=='custom');
export const sectionById = id => SECTION_CATALOG.find(x=>x.id===id);
export const sectionVisible = (resume,id) => {
  const order=resume?.settings?.sectionOrder;
  if(Array.isArray(order)&&order.length&&!order.includes(id))return false;
  return !(resume?.settings?.hiddenSections||[]).includes(id);
};
