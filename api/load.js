// api/load.js - полная версия с Supabase
import { createClient } from '@supabase/supabase-js';

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
    
    console.log('=== LOAD API START ===');
    console.log('initData получен:', !!initData);
    
    // Проверяем environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Environment variables отсутствуют');
      return res.status(500).json({ 
        error: 'Environment variables not configured',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      });
    }

    // Если нет initData - возвращаем тестовые данные
    if (!initData) {
      console.log('⚠️ Нет initData - возвращаем тестовые данные');
      return res.json({
        tasks: [
          {
            id: 'demo1',
            text: 'Тестовая задача (без авторизации)',
            completed: false,
            createdAt: new Date().toISOString()
          }
        ],
        notes: [
          {
            id: 'demo2',
            text: 'Тестовая заметка (без авторизации)',
            createdAt: new Date().toISOString()
          }
        ],
        debug: {
          mode: 'demo',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Инициализируем Supabase клиент
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase клиент создан');

    // Парсинг данных пользователя
    const urlParams = new URLSearchParams(initData);
    const userDataStr = urlParams.get('user');
    const user = userDataStr ? JSON.parse(userDataStr) : null;
    
    if (!user) {
      console.error('❌ Данные пользователя не найдены');
      return res.status(400).json({ error: 'User data not found in initData' });
    }

    console.log('✅ Пользователь найден:', user.first_name, '(ID:', user.id, ')');

    // Загружаем задачи из Supabase
    console.log('Загружаем задачи...');
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('❌ Ошибка загрузки задач:', tasksError);
      throw new Error('Tasks load error: ' + tasksError.message);
    }
    console.log('✅ Задачи загружены:', tasks?.length || 0);

    // Загружаем заметки из Supabase
    console.log('Загружаем заметки...');
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('❌ Ошибка загрузки заметок:', notesError);
      throw new Error('Notes load error: ' + notesError.message);
    }
    console.log('✅ Заметки загружены:', notes?.length || 0);

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

    console.log('=== LOAD API SUCCESS ===');
    res.json({
      tasks: formattedTasks,
      notes: formattedNotes,
      debug: {
        timestamp: new Date().toISOString(),
        userId: user.id,
        loadedTasks: formattedTasks.length,
        loadedNotes: formattedNotes.length
      }
    });
    
  } catch (error) {
    console.error('=== LOAD API ERROR ===');
    console.error('Полная ошибка:', error);
    res.status(500).json({ 
      error: 'Server error: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
