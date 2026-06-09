/**
 * aiGenerator.ts
 *
 * Pattern-based AI content generator — no model download required.
 * Understands Spanish and English natural language requests and produces
 * proper Markdown blocks for tables, todo lists, bullet lists, and more.
 */

// ─────────────────────────────────────────────────────────────
// Table generation
// ─────────────────────────────────────────────────────────────

interface TableTemplate {
  headers: string[];
  rows: string[][];
}

function detectTableTemplate(prompt: string): TableTemplate {
  const lower = prompt.toLowerCase();

  // Daily routine / schedule
  if (/rutina|horario|schedule|routine|día|diaria|daily/i.test(lower)) {
    return {
      headers: ['Hora', 'Actividad', 'Duración'],
      rows: [
        ['6:00 AM', 'Despertar y estiramiento', '10 min'],
        ['6:10 AM', 'Ducha', '15 min'],
        ['6:25 AM', 'Desayuno', '20 min'],
        ['7:00 AM', 'Preparación para salir', '20 min'],
        ['7:20 AM', 'Transporte al trabajo', '40 min'],
        ['8:00 AM', 'Inicio jornada laboral', '—'],
        ['1:00 PM', 'Almuerzo', '1 hora'],
        ['5:00 PM', 'Fin de jornada', '—'],
        ['5:30 PM', 'Ejercicio o deporte', '45 min'],
        ['7:00 PM', 'Cena', '30 min'],
        ['8:00 PM', 'Tiempo libre / hobbies', '1-2 horas'],
        ['10:30 PM', 'Dormir', '—'],
      ]
    };
  }

  // Tasks / project
  if (/tarea|task|proyecto|project/i.test(lower)) {
    return {
      headers: ['Tarea', 'Responsable', 'Estado', 'Prioridad', 'Fecha límite'],
      rows: [
        ['—', '—', 'Pendiente', 'Alta', '—'],
        ['—', '—', 'En progreso', 'Media', '—'],
        ['—', '—', 'Pendiente', 'Baja', '—'],
      ]
    };
  }

  // Budget / expenses
  if (/presupuesto|budget|gasto|expense|costo|costo|cost/i.test(lower)) {
    return {
      headers: ['Categoría', 'Descripción', 'Monto', 'Fecha'],
      rows: [
        ['Alimentación', 'Supermercado', '$—', '—'],
        ['Transporte', 'Gasolina / Bus', '$—', '—'],
        ['Vivienda', 'Arriendo / Servicios', '$—', '—'],
        ['Entretenimiento', 'Streaming / Salidas', '$—', '—'],
        ['Salud', 'Medicamentos / Gym', '$—', '—'],
      ]
    };
  }

  // Comparison / vs
  if (/comparac|compare|comparar|diferencia|\bvs\b|\bversus\b/i.test(lower)) {
    return {
      headers: ['Característica', 'Opción A', 'Opción B'],
      rows: [
        ['Precio', '—', '—'],
        ['Calidad', '—', '—'],
        ['Facilidad de uso', '—', '—'],
        ['Soporte', '—', '—'],
        ['Conclusión', '—', '—'],
      ]
    };
  }

  // Contacts / directory
  if (/contacto|contact|directorio|directory|equipo|team/i.test(lower)) {
    return {
      headers: ['Nombre', 'Cargo', 'Email', 'Teléfono'],
      rows: [
        ['—', '—', '—', '—'],
        ['—', '—', '—', '—'],
        ['—', '—', '—', '—'],
      ]
    };
  }

  // Weekly plan
  if (/semana|semanal|weekly|week/i.test(lower)) {
    return {
      headers: ['Día', 'Mañana', 'Tarde', 'Noche'],
      rows: [
        ['Lunes', '—', '—', '—'],
        ['Martes', '—', '—', '—'],
        ['Miércoles', '—', '—', '—'],
        ['Jueves', '—', '—', '—'],
        ['Viernes', '—', '—', '—'],
        ['Sábado', '—', '—', '—'],
        ['Domingo', '—', '—', '—'],
      ]
    };
  }

  // Goals / objectives
  if (/objetivo|goal|meta|kpi|result/i.test(lower)) {
    return {
      headers: ['Objetivo', 'Métrica', 'Meta', 'Actual', 'Estado'],
      rows: [
        ['—', '—', '—', '—', '—'],
        ['—', '—', '—', '—', '—'],
        ['—', '—', '—', '—', '—'],
      ]
    };
  }

  // Try to extract explicit columns from the prompt
  const colMatch = prompt.match(/columnas?[:\s]+([^.!?\n]+)/i)
    || prompt.match(/con(?:\s+las?\s+columnas?)?[:\s]+([^.!?\n]+)/i)
    || prompt.match(/fields?[:\s]+([^.!?\n]+)/i);

  if (colMatch) {
    const colStr = colMatch[1];
    const cols = colStr
      .split(/[,;]|\s+y\s+|\s+and\s+/)
      .map(c => c.trim().replace(/^["']|["']$/g, ''))
      .filter(c => c.length > 0 && c.length < 40);

    if (cols.length >= 2) {
      return {
        headers: cols,
        rows: Array(3).fill(null).map(() => cols.map(() => '—'))
      };
    }
  }

  // Generic fallback
  return {
    headers: ['Nombre', 'Descripción', 'Estado'],
    rows: [
      ['—', '—', '—'],
      ['—', '—', '—'],
      ['—', '—', '—'],
    ]
  };
}

function generateTable(prompt: string): string {
  const { headers, rows } = detectTableTemplate(prompt);
  const header = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
  return `${header}\n${separator}\n${body}`;
}

// ─────────────────────────────────────────────────────────────
// Item extraction for lists / todos
// ─────────────────────────────────────────────────────────────

function extractItems(prompt: string): string[] {
  // Remove common filler phrases to expose the item list
  let cleaned = prompt
    .replace(/hazme|crea(?:me)?|genera(?:me)?|make(?:\s+me)?|create|generate/gi, '')
    .replace(/una?\s+lista\s+(?:to[\s-]?do|de\s+(?:tareas?|pendientes?|cosas?|items?))?/gi, '')
    .replace(/to[\s-]?do(?:\s+list)?/gi, '')
    .replace(/lista\s+de\s+(?:tareas?|cosas?|pendientes?|items?|actividades?)/gi, '')
    .replace(/checklist\s+(?:de|of)?/gi, '')
    .replace(/una?\s+lista\s+(?:de|with|con)?/gi, '')
    .replace(/lista\s+(?:con|with|de)?/gi, '')
    .replace(/list\s+(?:of|with)?/gi, '')
    .replace(/(?:con|about|sobre|de|of|with|que\s+incluya|que\s+tenga|incluyendo|including):/gi, ':')
    .replace(/^[^:]*:\s*/, '') // Remove everything before a colon if present
    .trim();

  // Split by commas, semicolons, "y", "and", bullet points
  const parts = cleaned
    .split(/[,;]|\s+y\s+|\s+and\s+|•|\n\s*[-*]\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 80);

  return parts.length > 0 ? parts : [];
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────
// Main generator
// ─────────────────────────────────────────────────────────────

export function generateFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();

  // ── TABLE ──────────────────────────────────────────────────
  if (/tabla|table|cuadro|grid|spreadsheet/i.test(lower)) {
    return generateTable(prompt);
  }

  // ── TODO / CHECKLIST ───────────────────────────────────────
  if (
    /to[\s-]?do|checklist|check\s+list|lista.*(?:tareas?|pendientes?|cosas?\s+por\s+hacer)/i.test(lower) ||
    /lista\s+de\s+tareas?/i.test(lower)
  ) {
    const items = extractItems(prompt);
    if (items.length > 0) {
      return items.map(item => `- [ ] ${capitalizeFirst(item)}`).join('\n');
    }
    return '- [ ] Tarea 1\n- [ ] Tarea 2\n- [ ] Tarea 3';
  }

  // ── BULLET LIST ────────────────────────────────────────────
  if (/lista|list(?!\s+of\s+tasks)|enumera|items?|bullet|puntos?/i.test(lower)) {
    const items = extractItems(prompt);
    if (items.length > 0) {
      return items.map(item => `- ${capitalizeFirst(item)}`).join('\n');
    }
    return '- Elemento 1\n- Elemento 2\n- Elemento 3';
  }

  // ── CODE BLOCK ─────────────────────────────────────────────
  if (/código|code|función|function|script|programa/i.test(lower)) {
    const langMatch = prompt.match(/(?:en|in)\s+(javascript|typescript|python|html|css|sql|java|go|rust|php|bash)/i);
    const lang = langMatch ? langMatch[1].toLowerCase() : 'javascript';
    return `\`\`\`${lang}\n// Tu código aquí\n\`\`\``;
  }

  // ── HEADINGS ────────────────────────────────────────────────
  if (/título|titulo|heading|encabezado|sección|section/i.test(lower)) {
    const clean = prompt
      .replace(/(?:crea(?:me)?|genera(?:me)?|pon|agrega|add|create)?\s*(?:un\s+)?(?:título|titulo|heading|encabezado|sección|section)\s*(?:que\s+diga|de|:)?/gi, '')
      .trim();
    return `# ${capitalizeFirst(clean) || 'Nueva Sección'}`;
  }

  // ── NUMBERED STEPS / PASOS ──────────────────────────────────
  if (/pasos?|steps?|instrucciones?|instructions?|cómo\s+hacer|how\s+to/i.test(lower)) {
    const items = extractItems(prompt);
    if (items.length > 0) {
      return items.map((item, i) => `${i + 1}. ${capitalizeFirst(item)}`).join('\n');
    }
    return '1. Primer paso\n2. Segundo paso\n3. Tercer paso';
  }

  // ── DEFAULT — produce a structured paragraph ────────────────
  return capitalizeFirst(prompt.trim());
}
