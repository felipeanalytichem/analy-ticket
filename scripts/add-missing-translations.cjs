#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  translationDir: path.join(__dirname, '../src/i18n/locales'),
  missingKeysFile: path.join(__dirname, '../translation-audit-reports/missing-keys.json'),
  backupDir: path.join(__dirname, '../translation-backups')
};

// Missing translations to add to all languages
const MISSING_TRANSLATIONS = {
  // Common UI elements that are missing
  'common.filter': {
    'en-US': 'Filter',
    'pt-BR': 'Filtrar',
    'es-ES': 'Filtrar'
  },
  'common.clear': {
    'en-US': 'Clear',
    'pt-BR': 'Limpar',
    'es-ES': 'Limpiar'
  },
  'common.refresh': {
    'en-US': 'Refresh',
    'pt-BR': 'Atualizar',
    'es-ES': 'Actualizar'
  },
  'common.export': {
    'en-US': 'Export',
    'pt-BR': 'Exportar',
    'es-ES': 'Exportar'
  },
  'common.import': {
    'en-US': 'Import',
    'pt-BR': 'Importar',
    'es-ES': 'Importar'
  },
  'common.share': {
    'en-US': 'Share',
    'pt-BR': 'Compartilhar',
    'es-ES': 'Compartir'
  },
  'common.print': {
    'en-US': 'Print',
    'pt-BR': 'Imprimir',
    'es-ES': 'Imprimir'
  },
  'common.totalTickets': {
    'en-US': 'Total Tickets',
    'pt-BR': 'Total de Chamados',
    'es-ES': 'Total de Tickets'
  },
  'common.agent': {
    'en-US': 'Agent',
    'pt-BR': 'Agente',
    'es-ES': 'Agente'
  },
  'common.unknownUser': {
    'en-US': 'Unknown User',
    'pt-BR': 'Usuário Desconhecido',
    'es-ES': 'Usuario Desconocido'
  },
  'common.not_available': {
    'en-US': 'N/A',
    'pt-BR': 'N/A',
    'es-ES': 'N/A'
  },
  'common.all': {
    'en-US': 'All',
    'pt-BR': 'Todos',
    'es-ES': 'Todos'
  },
  'common.copyright': {
    'en-US': '© 2024 AnalytiChem GmbH. All rights reserved.',
    'pt-BR': '© 2024 AnalytiChem GmbH. Todos os direitos reservados.',
    'es-ES': '© 2024 AnalytiChem GmbH. Todos los derechos reservados.'
  },
  'common.pageNotFound': {
    'en-US': 'Oops! Page not found',
    'pt-BR': 'Oops! Página não encontrada',
    'es-ES': '¡Ups! Página no encontrada'
  },
  'common.returnToHome': {
    'en-US': 'Return to Home',
    'pt-BR': 'Voltar para o Início',
    'es-ES': 'Volver al Inicio'
  },
  'common.admin': {
    'en-US': 'Administrator',
    'pt-BR': 'Administrador',
    'es-ES': 'Administrador'
  },
  'common.welcomeBack': {
    'en-US': 'Welcome back',
    'pt-BR': 'Bem-vindo de volta',
    'es-ES': 'Bienvenido de vuelta'
  },

  // Tickets section
  'tickets.createdOn': {
    'en-US': 'Created on {{date}}',
    'pt-BR': 'Criado em {{date}}',
    'es-ES': 'Creado el {{date}}'
  },
  'tickets.updatedOn': {
    'en-US': 'Updated on {{date}}',
    'pt-BR': 'Atualizado em {{date}}',
    'es-ES': 'Actualizado el {{date}}'
  },

  // Comments section
  'comments.addPlaceholder': {
    'en-US': 'Add a comment...',
    'pt-BR': 'Adicionar um comentário...',
    'es-ES': 'Agregar un comentario...'
  },

  // Feedback section
  'feedback.experiencePlaceholder': {
    'en-US': 'Tell us more about your experience...',
    'pt-BR': 'Conte-nos mais sobre sua experiência...',
    'es-ES': 'Cuéntanos más sobre tu experiencia...'
  },

  // Agent section
  'agent.internalNotePlaceholder': {
    'en-US': 'Add an internal note for other agents...',
    'pt-BR': 'Adicionar uma nota interna para outros agentes...',
    'es-ES': 'Agregar una nota interna para otros agentes...'
  },
  'agent.responsePlaceholder': {
    'en-US': 'Write your response to the user...',
    'pt-BR': 'Escreva sua resposta ao usuário...',
    'es-ES': 'Escriba su respuesta al usuario...'
  },

  // Placeholders section
  'placeholders.searchTickets': {
    'en-US': 'Search tickets...',
    'pt-BR': 'Pesquisar chamados...',
    'es-ES': 'Buscar tickets...'
  },
  'placeholders.enterTaskTitle': {
    'en-US': 'Enter task title...',
    'pt-BR': 'Digite o título da tarefa...',
    'es-ES': 'Ingrese el título de la tarea...'
  },
  'placeholders.addComment': {
    'en-US': 'Add a comment...',
    'pt-BR': 'Adicionar um comentário...',
    'es-ES': 'Agregar un comentario...'
  },
  'placeholders.selectAgent': {
    'en-US': 'Select agent...',
    'pt-BR': 'Selecionar agente...',
    'es-ES': 'Seleccionar agente...'
  },
  'placeholders.selectTicket': {
    'en-US': 'Select ticket...',
    'pt-BR': 'Selecionar chamado...',
    'es-ES': 'Seleccionar ticket...'
  },
  'placeholders.enterTag': {
    'en-US': 'Enter a tag...',
    'pt-BR': 'Digite uma etiqueta...',
    'es-ES': 'Ingrese una etiqueta...'
  },
  'placeholders.helpImprove': {
    'en-US': 'Help us improve! What information were you looking for that you couldn\'t find?',
    'pt-BR': 'Ajude-nos a melhorar! Que informação você estava procurando que não conseguiu encontrar?',
    'es-ES': '¡Ayúdanos a mejorar! ¿Qué información buscabas que no pudiste encontrar?'
  },
  'placeholders.testMessage': {
    'en-US': 'Test message...',
    'pt-BR': 'Mensagem de teste...',
    'es-ES': 'Mensaje de prueba...'
  },

  // ARIA labels for accessibility
  'aria.deleteNotification': {
    'en-US': 'Delete notification',
    'pt-BR': 'Excluir notificação',
    'es-ES': 'Eliminar notificación'
  },
  'aria.openTicket': {
    'en-US': 'Open ticket',
    'pt-BR': 'Abrir chamado',
    'es-ES': 'Abrir ticket'
  },
  'aria.removeTag': {
    'en-US': 'Remove tag',
    'pt-BR': 'Remover etiqueta',
    'es-ES': 'Quitar etiqueta'
  },
  'aria.attachFile': {
    'en-US': 'Attach file',
    'pt-BR': 'Anexar arquivo',
    'es-ES': 'Adjuntar archivo'
  },
  'aria.attachImage': {
    'en-US': 'Attach image',
    'pt-BR': 'Anexar imagem',
    'es-ES': 'Adjuntar imagen'
  },

  // Titles section
  'titles.preview': {
    'en-US': 'Preview',
    'pt-BR': 'Visualizar',
    'es-ES': 'Vista previa'
  },
  'titles.download': {
    'en-US': 'Download',
    'pt-BR': 'Baixar',
    'es-ES': 'Descargar'
  },
  'titles.generating': {
    'en-US': 'Generating preview...',
    'pt-BR': 'Gerando visualização...',
    'es-ES': 'Generando vista previa...'
  },
  'titles.removeFile': {
    'en-US': 'Remove file',
    'pt-BR': 'Remover arquivo',
    'es-ES': 'Quitar archivo'
  },
  'titles.formBuilder': {
    'en-US': 'Form builder',
    'pt-BR': 'Construtor de formulários',
    'es-ES': 'Constructor de formularios'
  },

  // Chat section
  'chat.tab': {
    'en-US': 'Chat',
    'pt-BR': 'Chat',
    'es-ES': 'Chat'
  },
  'chat.loading': {
    'en-US': 'Loading messages...',
    'pt-BR': 'Carregando mensagens...',
    'es-ES': 'Cargando mensajes...'
  },
  'chat.noMessages': {
    'en-US': 'No messages yet',
    'pt-BR': 'Ainda não há mensagens',
    'es-ES': 'Aún no hay mensajes'
  },
  'chat.typeMessage': {
    'en-US': 'Type a message...',
    'pt-BR': 'Digite uma mensagem...',
    'es-ES': 'Escribe un mensaje...'
  },
  'chat.send': {
    'en-US': 'Send',
    'pt-BR': 'Enviar',
    'es-ES': 'Enviar'
  }
};

class TranslationUpdater {
  constructor() {
    this.translationFiles = {};
    this.backupCreated = false;
  }

  async run() {
    console.log('🔄 Starting translation update process...\n');
    
    try {
      // Create backup
      await this.createBackup();
      
      // Load existing translation files
      await this.loadTranslationFiles();
      
      // Add missing translations
      await this.addMissingTranslations();
      
      // Save updated files
      await this.saveTranslationFiles();
      
      console.log('\n✅ Translation update completed successfully!');
      console.log(`📁 Backup created in: ${CONFIG.backupDir}`);
      
    } catch (error) {
      console.error('❌ Error during translation update:', error);
      
      if (this.backupCreated) {
        console.log('🔄 Restoring from backup...');
        await this.restoreFromBackup();
      }
      
      process.exit(1);
    }
  }

  async createBackup() {
    console.log('💾 Creating backup of translation files...');
    
    if (!fs.existsSync(CONFIG.backupDir)) {
      fs.mkdirSync(CONFIG.backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubDir = path.join(CONFIG.backupDir, `backup-${timestamp}`);
    fs.mkdirSync(backupSubDir, { recursive: true });
    
    const translationFiles = fs.readdirSync(CONFIG.translationDir)
      .filter(file => file.endsWith('.json'));
    
    for (const file of translationFiles) {
      const sourcePath = path.join(CONFIG.translationDir, file);
      const backupPath = path.join(backupSubDir, file);
      fs.copyFileSync(sourcePath, backupPath);
    }
    
    this.backupPath = backupSubDir;
    this.backupCreated = true;
    console.log(`  ✓ Backup created: ${backupSubDir}`);
  }

  async loadTranslationFiles() {
    console.log('📚 Loading existing translation files...');
    
    const translationFiles = fs.readdirSync(CONFIG.translationDir)
      .filter(file => file.endsWith('.json'));
    
    for (const file of translationFiles) {
      const filePath = path.join(CONFIG.translationDir, file);
      const locale = path.basename(file, '.json');
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.translationFiles[locale] = JSON.parse(content);
        console.log(`  ✓ Loaded ${locale}: ${this.countKeys(this.translationFiles[locale])} keys`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to load ${file}:`, error.message);
      }
    }
  }

  countKeys(obj, prefix = '') {
    let count = 0;
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        count += this.countKeys(obj[key], prefix + key + '.');
      } else {
        count++;
      }
    }
    return count;
  }

  async addMissingTranslations() {
    console.log('\n🔧 Adding missing translations...');
    
    let totalAdded = 0;
    
    for (const [keyPath, translations] of Object.entries(MISSING_TRANSLATIONS)) {
      for (const locale of Object.keys(this.translationFiles)) {
        if (translations[locale]) {
          const added = this.setNestedKey(this.translationFiles[locale], keyPath, translations[locale]);
          if (added) {
            totalAdded++;
            console.log(`  ✓ Added ${locale}: ${keyPath} = "${translations[locale]}"`);
          }
        } else {
          // Use English as fallback
          const fallback = translations['en-US'] || keyPath;
          const added = this.setNestedKey(this.translationFiles[locale], keyPath, fallback);
          if (added) {
            totalAdded++;
            console.log(`  ⚠️  Added ${locale}: ${keyPath} = "${fallback}" (fallback)`);
          }
        }
      }
    }
    
    console.log(`\n📊 Total translations added: ${totalAdded}`);
  }

  setNestedKey(obj, keyPath, value) {
    const keys = keyPath.split('.');
    let current = obj;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    const finalKey = keys[keys.length - 1];
    
    // Only add if the key doesn't exist
    if (!(finalKey in current)) {
      current[finalKey] = value;
      return true;
    }
    
    return false;
  }

  async saveTranslationFiles() {
    console.log('\n💾 Saving updated translation files...');
    
    for (const [locale, translations] of Object.entries(this.translationFiles)) {
      const filePath = path.join(CONFIG.translationDir, `${locale}.json`);
      const content = JSON.stringify(translations, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');
      
      const keyCount = this.countKeys(translations);
      console.log(`  ✓ Saved ${locale}: ${keyCount} keys`);
    }
  }

  async restoreFromBackup() {
    if (!this.backupPath) {
      console.error('No backup path available for restoration');
      return;
    }
    
    const backupFiles = fs.readdirSync(this.backupPath);
    
    for (const file of backupFiles) {
      const backupFilePath = path.join(this.backupPath, file);
      const originalFilePath = path.join(CONFIG.translationDir, file);
      fs.copyFileSync(backupFilePath, originalFilePath);
    }
    
    console.log('✅ Restored from backup successfully');
  }
}

// Run the updater if this script is executed directly
if (require.main === module) {
  const updater = new TranslationUpdater();
  updater.run().catch(console.error);
}

module.exports = TranslationUpdater;