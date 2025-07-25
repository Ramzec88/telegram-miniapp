import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Добавляем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { initData, tasks, notes } = req.body;
    
    // Парсинг данных пользователя Telegram
    const urlParams = new URLSearchParams(initData);
    const userDataStr = urlParams.get('user');
    const user = userDataStr ? JSON.parse(userDataStr) : null;
    
    if (!user) {
      return res.status(400).json({ error: 'User data not found' });
    }

    // Сохраняем/обновляем пользователя
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        updated_at: new Date().toISOString()
      });

    if (userError) throw userError;

    // Удаляем старые данные
    await supabase.from('tasks').delete().eq('user_id', user.id);
    await supabase.from('notes').delete().eq('user_id', user.id);

    // Сохраняем задачи
    if (tasks && tasks.length > 0) {
      const tasksToInsert = tasks.map(task => ({
        user_id: user.id,
        text: task.text,
        completed: task.completed,
        created_at: task.createdAt
      }));
      
      const { error: tasksError } = await supabase.from('tasks').insert(tasksToInsert);
      if (tasksError) throw tasksError;
    }

    // Сохраняем заметки
    if (notes && notes.length > 0) {
      const notesToInsert = notes.map(note => ({
        user_id: user.id,
        text: note.text,
        created_at: note.createdAt
      }));
      
      const { error: notesError } = await supabase.from('notes').insert(notesToInsert);
      if (notesError) throw notesError;
    }

    res.json({ success: true, message: 'Данные сохранены' });
    
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
}
