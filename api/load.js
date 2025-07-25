import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { initData } = req.query;
    
    if (!initData) {
      return res.status(400).json({ error: 'Init data required' });
    }

    const urlParams = new URLSearchParams(initData);
    const userDataStr = urlParams.get('user');
    const user = userDataStr ? JSON.parse(userDataStr) : null;
    
    if (!user) {
      return res.status(400).json({ error: 'User data not found' });
    }

    // Загружаем задачи
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (tasksError) throw tasksError;

    // Загружаем заметки
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (notesError) throw notesError;

    // Преобразуем в формат приложения
    const formattedTasks = (tasks || []).map(task => ({
      id: task.id,
      text: task.text,
      completed: task.completed,
      createdAt: task.created_at
    }));

    const formattedNotes = (notes || []).map(note => ({
      id: note.id,
      text: note.text,
      createdAt: note.created_at
    }));

    res.json({
      tasks: formattedTasks,
      notes: formattedNotes,
      updatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
}
