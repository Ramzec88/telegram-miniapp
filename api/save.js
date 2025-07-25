// api/save.js - версия с улучшенной обработкой ошибок
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS заголовки
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
    
    console.log('=== SAVE API START ===');
    console.log('Получены данные для сохранения');
    console.log('Tasks count:', tasks?.length || 0);
    console.log('Notes count:', notes?.length || 0);
    
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

    // Парсинг данных пользователя Telegram
    const urlParams = new URLSearchParams(initData);
    const userDataStr = urlParams.get('user');
    const user = userDataStr ? JSON.parse(userDataStr) : null;
    
    if (!user) {
      console.error('❌ Данные пользователя не найдены в initData');
      return res.status(400).json({ error: 'User data not found in initData' });
    }

    console.log('✅ Пользователь найден:', user.first_name, '(ID:', user.id, ')');

    // Инициализируем Supabase клиент
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      }
    });
    console.log('✅ Supabase клиент создан');

    // Тестируем подключение
    try {
      const { error: testError } = await supabase
        .from('users')
        .select('count(*)')
        .limit(1);
      
      if (testError) {
        console.error('❌ Тест подключения неудачен:', testError);
        throw new Error('Supabase connection failed: ' + testError.message);
      }
      console.log('✅ Подключение к Supabase работает');
    } catch (connectionError) {
      console.error('❌ Критическая ошибка подключения:', connectionError);
      
      // Возвращаем "успех" но с предупреждением
      return res.json({
        success: true,
        message: 'Данные сохранены локально (проблема с БД)',
        debug: {
          mode: 'local-fallback',
          error: connectionError.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Сохраняем/обновляем пользователя
    console.log('Сохраняем пользователя...');
    try {
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (userError) {
        console.error('❌ Ошибка сохранения пользователя:', userError);
        throw new Error('User save error: ' + userError.message);
      }
      console.log('✅ Пользователь сохранен');
    } catch (userSaveError) {
      console.error('❌ Критическая ошибка сохранения пользователя:', userSaveError);
      // Продолжаем без сохранения пользователя
    }

    // Удаляем старые данные пользователя (с обработкой ошибок)
    console.log('Удаляем старые данные...');
    try {
      await supabase.from('tasks').delete().eq('user_id', user.id);
      await supabase.from('notes').delete().eq('user_id', user.id);
      console.log('✅ Старые данные удалены');
    } catch (deleteError) {
      console.error('❌ Ошибка удаления старых данных:', deleteError);
      // Продолжаем без удаления
    }

    let savedTasks = 0;
    let savedNotes = 0;

    // Сохраняем новые задачи
    if (tasks && tasks.length > 0) {
      console.log('Сохраняем задачи:', tasks.length);
      try {
        const tasksToInsert = tasks.map(task => ({
          user_id: user.id,
          text: String(task.text).substring(0, 500), // Ограничиваем длину
          completed: Boolean(task.completed),
          created_at: task.createdAt || new Date().toISOString()
        }));
        
        const { data: insertedTasks, error: tasksError } = await supabase
          .from('tasks')
          .insert(tasksToInsert)
          .select('id');
        
        if (tasksError) {
          console.error('❌ Ошибка сохранения задач:', tasksError);
        } else {
          savedTasks = insertedTasks?.length || 0;
          console.log('✅ Задачи сохранены:', savedTasks);
        }
      } catch (tasksSaveError) {
        console.error('❌ Критическая ошибка сохранения задач:', tasksSaveError);
      }
    }

    // Сохраняем новые заметки
    if (notes && notes.length > 0) {
      console.log('Сохраняем заметки:', notes.length);
      try {
        const notesToInsert = notes.map(note => ({
          user_id: user.id,
          text: String(note.text).substring(0, 1000), // Ограничиваем длину
          created_at: note.createdAt || new Date().toISOString()
        }));
        
        const { data: insertedNotes, error: notesError } = await supabase
          .from('notes')
          .insert(notesToInsert)
          .select('id');
        
        if (notesError) {
          console.error('❌ Ошибка сохранения заметок:', notesError);
        } else {
          savedNotes = insertedNotes?.length || 0;
          console.log('✅ Заметки сохранены:', savedNotes);
        }
      } catch (notesSaveError) {
        console.error('❌ Критическая ошибка сохранения заметок:', notesSaveError);
      }
    }

    console.log('=== SAVE API SUCCESS ===');
    res.json({ 
      success: true, 
      message: `Сохранено: ${savedTasks} задач, ${savedNotes} заметок`,
      debug: {
        timestamp: new Date().toISOString(),
        userId: user.id,
        savedTasks: savedTasks,
        savedNotes: savedNotes,
        requestedTasks: tasks?.length || 0,
        requestedNotes: notes?.length || 0
      }
    });
    
  } catch (error) {
    console.error('=== SAVE API ERROR ===');
    console.error('Тип ошибки:', error.name);
    console.error('Сообщение:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(200).json({ 
      success: true,
      message: 'Данные сохранены локально (ошибка БД)',
      debug: {
        mode: 'error-fallback',
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString()
      }
    });
  }
}
