#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  translationDir: path.join(__dirname, '../src/i18n/locales'),
  sourceLocale: 'en-US',
  newLocales: ['fr-FR', 'nl-NL', 'de-DE']
};

// Base translations for the new languages
const BASE_TRANSLATIONS = {
  'fr-FR': {
    // Common UI elements
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.edit': 'Modifier',
    'common.delete': 'Supprimer',
    'common.close': 'Fermer',
    'common.confirm': 'Confirmer',
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.warning': 'Avertissement',
    'common.info': 'Information',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.previous': 'Précédent',
    'common.search': 'Rechercher',
    'common.searchPlaceholder': 'Rechercher...',
    'common.filter': 'Filtrer',
    'common.clear': 'Effacer',
    'common.refresh': 'Actualiser',
    'common.export': 'Exporter',
    'common.import': 'Importer',
    'common.download': 'Télécharger',
    'common.upload': 'Téléverser',
    'common.share': 'Partager',
    'common.print': 'Imprimer',
    'common.send': 'Envoyer',
    'common.submit': 'Soumettre',
    'common.create': 'Créer',
    'common.update': 'Mettre à jour',
    'common.preview': 'Aperçu',
    'common.remove': 'Supprimer',
    'common.titlePlaceholder': 'Entrez le titre...',
    'common.descriptionPlaceholder': 'Entrez la description...',
    'common.totalTickets': 'Total des Tickets',
    'common.agent': 'Agent',
    'common.unknownUser': 'Utilisateur Inconnu',
    'common.not_available': 'N/A',
    'common.all': 'Tous',
    'common.copyright': '© 2024 AnalytiChem GmbH. Tous droits réservés.',
    'common.pageNotFound': 'Oups ! Page non trouvée',
    'common.returnToHome': 'Retour à l\'accueil',
    'common.admin': 'Administrateur',
    'common.welcomeBack': 'Bon retour',

    // Navigation
    'navigation.dashboard': 'Tableau de bord',
    'navigation.tickets': 'Tickets',
    'navigation.myTickets': 'Mes Tickets',
    'navigation.allTickets': 'Tous les Tickets',
    'navigation.openTickets': 'Tickets Ouverts',
    'navigation.inProgressTickets': 'En Cours',
    'navigation.resolvedTickets': 'Résolus',
    'navigation.closedTickets': 'Fermés',
    'navigation.analytics': 'Analyses',
    'navigation.knowledge': 'Base de Connaissances',
    'navigation.reports': 'Rapports',
    'navigation.integrations': 'Intégrations',
    'navigation.admin': 'Administration',
    'navigation.profile': 'Profil',
    'navigation.settings': 'Paramètres',
    'navigation.notifications': 'Notifications',
    'navigation.logout': 'Déconnexion',
    'navigation.agentDashboard': 'Tableau de Bord Agent',
    'navigation.reopenRequests': 'Demandes de Réouverture',
    'navigation.todo': 'Tâches',
    'navigation.adminUsers': 'Gestion des Utilisateurs',
    'navigation.adminCategories': 'Gestion des Catégories',
    'navigation.adminSla': 'Configuration SLA',
    'navigation.knowledgeAdmin': 'Admin Connaissances',
    'navigation.mainMenu': 'Menu Principal',

    // Theme
    'theme.toggle': 'Basculer le thème',
    'theme.switchToDark': 'Passer au thème sombre',
    'theme.switchToLight': 'Passer au thème clair',
    'theme.switchToSystem': 'Passer au thème système',

    // Dashboard
    'dashboard.welcome': 'Bienvenue',
    'dashboard.totalTickets': 'Total des Tickets',
    'dashboard.avgResponseTime': 'Temps de Réponse Moyen',
    'dashboard.avgResolutionTime': 'Temps de Résolution Moyen',
    'dashboard.slaCompliance': 'Conformité SLA',
    'dashboard.customerSatisfaction': 'Satisfaction Client',
    'dashboard.firstContactResolution': 'Résolution au Premier Contact',
    'dashboard.activeAgents': 'Agents Actifs',
    'dashboard.resolvedToday': 'Résolus Aujourd\'hui',
    'dashboard.criticalPending': 'Critiques en Attente',
    'dashboard.goal': 'Objectif',
    'dashboard.thisMonth': 'ce mois',
    'dashboard.available': 'Disponibles',
    'dashboard.dailyGoal': 'Objectif quotidien',
    'dashboard.urgentAttention': 'Attention urgente',
    'dashboard.allGood': 'Tout va bien',
    'dashboard.openTickets': 'Tickets Ouverts',
    'dashboard.resolvedTickets': 'Tickets Résolus',
    'dashboard.closedTickets': 'Tickets Fermés',
    'dashboard.myTickets': 'Mes Tickets',
    'dashboard.assignedToMe': 'Assignés à Moi',
    'dashboard.overdueTickets': 'Tickets en Retard',
    'dashboard.recentTickets': 'Tickets Récents',
    'dashboard.lastTicketsCreated': 'Derniers tickets créés',

    // Tickets
    'tickets.newTicket': 'Nouveau Ticket',
    'tickets.ticketNumber': 'Numéro de Ticket',
    'tickets.title': 'Titre',
    'tickets.description': 'Description',
    'tickets.priority': 'Priorité',
    'tickets.category': 'Catégorie',
    'tickets.assignedTo': 'Assigné À',
    'tickets.createdBy': 'Créé Par',
    'tickets.createdAt': 'Créé Le',
    'tickets.updatedAt': 'Mis à Jour Le',
    'tickets.resolvedAt': 'Résolu Le',
    'tickets.closedAt': 'Fermé Le',
    'tickets.resolution': 'Résolution',
    'tickets.comments': 'Commentaires',
    'tickets.addComment': 'Ajouter un Commentaire',
    'tickets.untitled': 'Sans titre',
    'tickets.createdOn': 'Créé le {{date}}',
    'tickets.updatedOn': 'Mis à jour le {{date}}',

    // Status
    'status.open': 'Ouvert',
    'status.pending': 'En Attente',
    'status.inProgress': 'En Cours',
    'status.resolved': 'Résolu',
    'status.closed': 'Fermé',

    // Priority
    'priority.low': 'Faible',
    'priority.medium': 'Moyen',
    'priority.high': 'Élevé',
    'priority.urgent': 'Urgent',

    // Profile
    'profile.userProfile': 'Profil Utilisateur',
    'profile.backToDashboard': 'Retour au Tableau de Bord',
    'profile.personalInformation': 'Informations Personnelles',
    'profile.preferences': 'Préférences',
    'profile.personalStatistics': 'Statistiques Personnelles',
    'profile.recentActivities': 'Activités Récentes',
    'profile.security': 'Sécurité',
    'profile.editProfile': 'Modifier le Profil',
    'profile.changePassword': 'Changer le Mot de Passe',
    'profile.savePreferences': 'Enregistrer les Préférences',
    'profile.interfaceTheme': 'Thème de l\'Interface',
    'profile.language': 'Langue',
    'profile.notifications': 'Notifications',
    'profile.light': '☀️ Clair',
    'profile.dark': '🌙 Sombre',
    'profile.system': '🖥️ Système',
    'profile.english': '🇺🇸 English',
    'profile.portuguese': '🇧🇷 Português',
    'profile.spanish': '🇪🇸 Español',
    'profile.french': '🇫🇷 Français',
    'profile.dutch': '🇳🇱 Nederlands',
    'profile.german': '🇩🇪 Deutsch',

    // Auth
    'auth.login': 'Connexion',
    'auth.register': 'S\'inscrire',
    'auth.logout': 'Déconnexion',
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'auth.confirmPassword': 'Confirmer le mot de passe',
    'auth.forgotPassword': 'Mot de passe oublié ?',
    'auth.resetPassword': 'Réinitialiser le mot de passe',
    'auth.rememberMe': 'Se souvenir de moi',
    'auth.signIn': 'Se connecter',
    'auth.signUp': 'S\'inscrire',
    'auth.signOut': 'Se déconnecter',
    'auth.welcomeBack': 'Bon retour',
    'auth.loginInstructions': 'Connectez-vous pour accéder au système',
    'auth.enterCredentials': 'Entrez vos identifiants pour accéder à votre compte',
    'auth.emailPlaceholder': 'votre@email.com',
    'auth.passwordPlaceholder': 'Entrez votre mot de passe',
    'auth.loggingIn': 'Connexion...',
    'auth.fullName': 'Nom complet',
    'auth.fullNamePlaceholder': 'Votre nom complet',

    // Messages
    'messages.profileUpdated': 'Profil mis à jour avec succès !',
    'messages.passwordChanged': 'Mot de passe changé avec succès !',
    'messages.preferencesUpdated': 'Préférences mises à jour avec succès !',
    'messages.errorUpdatingProfile': 'Erreur lors de la mise à jour du profil',
    'messages.errorChangingPassword': 'Erreur lors du changement de mot de passe',
    'messages.errorSavingPreferences': 'Erreur lors de l\'enregistrement des préférences',
    'messages.passwordsDoNotMatch': 'Les mots de passe ne correspondent pas',
    'messages.passwordTooShort': 'Le mot de passe doit contenir au moins 6 caractères',
    'messages.errorLoadingProfile': 'Erreur lors du chargement des données du profil'
  },

  'nl-NL': {
    // Common UI elements
    'common.save': 'Opslaan',
    'common.cancel': 'Annuleren',
    'common.edit': 'Bewerken',
    'common.delete': 'Verwijderen',
    'common.close': 'Sluiten',
    'common.confirm': 'Bevestigen',
    'common.loading': 'Laden...',
    'common.error': 'Fout',
    'common.success': 'Succes',
    'common.warning': 'Waarschuwing',
    'common.info': 'Informatie',
    'common.yes': 'Ja',
    'common.no': 'Nee',
    'common.back': 'Terug',
    'common.next': 'Volgende',
    'common.previous': 'Vorige',
    'common.search': 'Zoeken',
    'common.searchPlaceholder': 'Zoeken...',
    'common.filter': 'Filteren',
    'common.clear': 'Wissen',
    'common.refresh': 'Vernieuwen',
    'common.export': 'Exporteren',
    'common.import': 'Importeren',
    'common.download': 'Downloaden',
    'common.upload': 'Uploaden',
    'common.share': 'Delen',
    'common.print': 'Afdrukken',
    'common.send': 'Verzenden',
    'common.submit': 'Indienen',
    'common.create': 'Aanmaken',
    'common.update': 'Bijwerken',
    'common.preview': 'Voorbeeld',
    'common.remove': 'Verwijderen',
    'common.titlePlaceholder': 'Voer titel in...',
    'common.descriptionPlaceholder': 'Voer beschrijving in...',
    'common.totalTickets': 'Totaal Tickets',
    'common.agent': 'Agent',
    'common.unknownUser': 'Onbekende Gebruiker',
    'common.not_available': 'N/B',
    'common.all': 'Alle',
    'common.copyright': '© 2024 AnalytiChem GmbH. Alle rechten voorbehouden.',
    'common.pageNotFound': 'Oeps! Pagina niet gevonden',
    'common.returnToHome': 'Terug naar Home',
    'common.admin': 'Beheerder',
    'common.welcomeBack': 'Welkom terug',

    // Navigation
    'navigation.dashboard': 'Dashboard',
    'navigation.tickets': 'Tickets',
    'navigation.myTickets': 'Mijn Tickets',
    'navigation.allTickets': 'Alle Tickets',
    'navigation.openTickets': 'Open Tickets',
    'navigation.inProgressTickets': 'In Behandeling',
    'navigation.resolvedTickets': 'Opgelost',
    'navigation.closedTickets': 'Gesloten',
    'navigation.analytics': 'Analytics',
    'navigation.knowledge': 'Kennisbank',
    'navigation.reports': 'Rapporten',
    'navigation.integrations': 'Integraties',
    'navigation.admin': 'Beheer',
    'navigation.profile': 'Profiel',
    'navigation.settings': 'Instellingen',
    'navigation.notifications': 'Meldingen',
    'navigation.logout': 'Uitloggen',
    'navigation.agentDashboard': 'Agent Dashboard',
    'navigation.reopenRequests': 'Heropening Verzoeken',
    'navigation.todo': 'Taken',
    'navigation.adminUsers': 'Gebruikersbeheer',
    'navigation.adminCategories': 'Categoriebeheer',
    'navigation.adminSla': 'SLA Configuratie',
    'navigation.knowledgeAdmin': 'Kennis Beheer',
    'navigation.mainMenu': 'Hoofdmenu',

    // Theme
    'theme.toggle': 'Thema wisselen',
    'theme.switchToDark': 'Overschakelen naar donker thema',
    'theme.switchToLight': 'Overschakelen naar licht thema',
    'theme.switchToSystem': 'Overschakelen naar systeemthema',

    // Dashboard
    'dashboard.welcome': 'Welkom',
    'dashboard.totalTickets': 'Totaal Tickets',
    'dashboard.avgResponseTime': 'Gem. Reactietijd',
    'dashboard.avgResolutionTime': 'Gem. Oplossingstijd',
    'dashboard.slaCompliance': 'SLA Naleving',
    'dashboard.customerSatisfaction': 'Klanttevredenheid',
    'dashboard.firstContactResolution': 'Eerste Contact Oplossing',
    'dashboard.activeAgents': 'Actieve Agenten',
    'dashboard.resolvedToday': 'Vandaag Opgelost',
    'dashboard.criticalPending': 'Kritiek Wachtend',
    'dashboard.goal': 'Doel',
    'dashboard.thisMonth': 'deze maand',
    'dashboard.available': 'Beschikbaar',
    'dashboard.dailyGoal': 'Dagelijks doel',
    'dashboard.urgentAttention': 'Urgente aandacht',
    'dashboard.allGood': 'Alles goed',
    'dashboard.openTickets': 'Open Tickets',
    'dashboard.resolvedTickets': 'Opgeloste Tickets',
    'dashboard.closedTickets': 'Gesloten Tickets',
    'dashboard.myTickets': 'Mijn Tickets',
    'dashboard.assignedToMe': 'Aan Mij Toegewezen',
    'dashboard.overdueTickets': 'Verlopen Tickets',
    'dashboard.recentTickets': 'Recente Tickets',
    'dashboard.lastTicketsCreated': 'Laatst aangemaakte tickets',

    // Tickets
    'tickets.newTicket': 'Nieuw Ticket',
    'tickets.ticketNumber': 'Ticketnummer',
    'tickets.title': 'Titel',
    'tickets.description': 'Beschrijving',
    'tickets.priority': 'Prioriteit',
    'tickets.category': 'Categorie',
    'tickets.assignedTo': 'Toegewezen Aan',
    'tickets.createdBy': 'Aangemaakt Door',
    'tickets.createdAt': 'Aangemaakt Op',
    'tickets.updatedAt': 'Bijgewerkt Op',
    'tickets.resolvedAt': 'Opgelost Op',
    'tickets.closedAt': 'Gesloten Op',
    'tickets.resolution': 'Oplossing',
    'tickets.comments': 'Opmerkingen',
    'tickets.addComment': 'Opmerking Toevoegen',
    'tickets.untitled': 'Zonder titel',
    'tickets.createdOn': 'Aangemaakt op {{date}}',
    'tickets.updatedOn': 'Bijgewerkt op {{date}}',

    // Status
    'status.open': 'Open',
    'status.pending': 'Wachtend',
    'status.inProgress': 'In Behandeling',
    'status.resolved': 'Opgelost',
    'status.closed': 'Gesloten',

    // Priority
    'priority.low': 'Laag',
    'priority.medium': 'Gemiddeld',
    'priority.high': 'Hoog',
    'priority.urgent': 'Urgent',

    // Profile
    'profile.userProfile': 'Gebruikersprofiel',
    'profile.backToDashboard': 'Terug naar Dashboard',
    'profile.personalInformation': 'Persoonlijke Informatie',
    'profile.preferences': 'Voorkeuren',
    'profile.personalStatistics': 'Persoonlijke Statistieken',
    'profile.recentActivities': 'Recente Activiteiten',
    'profile.security': 'Beveiliging',
    'profile.editProfile': 'Profiel Bewerken',
    'profile.changePassword': 'Wachtwoord Wijzigen',
    'profile.savePreferences': 'Voorkeuren Opslaan',
    'profile.interfaceTheme': 'Interface Thema',
    'profile.language': 'Taal',
    'profile.notifications': 'Meldingen',
    'profile.light': '☀️ Licht',
    'profile.dark': '🌙 Donker',
    'profile.system': '🖥️ Systeem',
    'profile.english': '🇺🇸 English',
    'profile.portuguese': '🇧🇷 Português',
    'profile.spanish': '🇪🇸 Español',
    'profile.french': '🇫🇷 Français',
    'profile.dutch': '🇳🇱 Nederlands',
    'profile.german': '🇩🇪 Deutsch',

    // Auth
    'auth.login': 'Inloggen',
    'auth.register': 'Registreren',
    'auth.logout': 'Uitloggen',
    'auth.email': 'Email',
    'auth.password': 'Wachtwoord',
    'auth.confirmPassword': 'Wachtwoord bevestigen',
    'auth.forgotPassword': 'Wachtwoord vergeten?',
    'auth.resetPassword': 'Wachtwoord resetten',
    'auth.rememberMe': 'Onthoud mij',
    'auth.signIn': 'Inloggen',
    'auth.signUp': 'Registreren',
    'auth.signOut': 'Uitloggen',
    'auth.welcomeBack': 'Welkom terug',
    'auth.loginInstructions': 'Log in om toegang te krijgen tot het systeem',
    'auth.enterCredentials': 'Voer uw inloggegevens in om toegang te krijgen tot uw account',
    'auth.emailPlaceholder': 'uw@email.com',
    'auth.passwordPlaceholder': 'Voer uw wachtwoord in',
    'auth.loggingIn': 'Inloggen...',
    'auth.fullName': 'Volledige naam',
    'auth.fullNamePlaceholder': 'Uw volledige naam',

    // Messages
    'messages.profileUpdated': 'Profiel succesvol bijgewerkt!',
    'messages.passwordChanged': 'Wachtwoord succesvol gewijzigd!',
    'messages.preferencesUpdated': 'Voorkeuren succesvol opgeslagen!',
    'messages.errorUpdatingProfile': 'Fout bij het bijwerken van profiel',
    'messages.errorChangingPassword': 'Fout bij het wijzigen van wachtwoord',
    'messages.errorSavingPreferences': 'Fout bij het opslaan van voorkeuren',
    'messages.passwordsDoNotMatch': 'Wachtwoorden komen niet overeen',
    'messages.passwordTooShort': 'Wachtwoord moet minimaal 6 tekens bevatten',
    'messages.errorLoadingProfile': 'Fout bij het laden van profielgegevens'
  },

  'de-DE': {
    // Common UI elements
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.edit': 'Bearbeiten',
    'common.delete': 'Löschen',
    'common.close': 'Schließen',
    'common.confirm': 'Bestätigen',
    'common.loading': 'Laden...',
    'common.error': 'Fehler',
    'common.success': 'Erfolg',
    'common.warning': 'Warnung',
    'common.info': 'Information',
    'common.yes': 'Ja',
    'common.no': 'Nein',
    'common.back': 'Zurück',
    'common.next': 'Weiter',
    'common.previous': 'Vorherige',
    'common.search': 'Suchen',
    'common.searchPlaceholder': 'Suchen...',
    'common.filter': 'Filtern',
    'common.clear': 'Löschen',
    'common.refresh': 'Aktualisieren',
    'common.export': 'Exportieren',
    'common.import': 'Importieren',
    'common.download': 'Herunterladen',
    'common.upload': 'Hochladen',
    'common.share': 'Teilen',
    'common.print': 'Drucken',
    'common.send': 'Senden',
    'common.submit': 'Absenden',
    'common.create': 'Erstellen',
    'common.update': 'Aktualisieren',
    'common.preview': 'Vorschau',
    'common.remove': 'Entfernen',
    'common.titlePlaceholder': 'Titel eingeben...',
    'common.descriptionPlaceholder': 'Beschreibung eingeben...',
    'common.totalTickets': 'Gesamt Tickets',
    'common.agent': 'Agent',
    'common.unknownUser': 'Unbekannter Benutzer',
    'common.not_available': 'N/V',
    'common.all': 'Alle',
    'common.copyright': '© 2024 AnalytiChem GmbH. Alle Rechte vorbehalten.',
    'common.pageNotFound': 'Ups! Seite nicht gefunden',
    'common.returnToHome': 'Zurück zur Startseite',
    'common.admin': 'Administrator',
    'common.welcomeBack': 'Willkommen zurück',

    // Navigation
    'navigation.dashboard': 'Dashboard',
    'navigation.tickets': 'Tickets',
    'navigation.myTickets': 'Meine Tickets',
    'navigation.allTickets': 'Alle Tickets',
    'navigation.openTickets': 'Offene Tickets',
    'navigation.inProgressTickets': 'In Bearbeitung',
    'navigation.resolvedTickets': 'Gelöst',
    'navigation.closedTickets': 'Geschlossen',
    'navigation.analytics': 'Analytics',
    'navigation.knowledge': 'Wissensdatenbank',
    'navigation.reports': 'Berichte',
    'navigation.integrations': 'Integrationen',
    'navigation.admin': 'Verwaltung',
    'navigation.profile': 'Profil',
    'navigation.settings': 'Einstellungen',
    'navigation.notifications': 'Benachrichtigungen',
    'navigation.logout': 'Abmelden',
    'navigation.agentDashboard': 'Agent Dashboard',
    'navigation.reopenRequests': 'Wiedereröffnungsanfragen',
    'navigation.todo': 'Aufgaben',
    'navigation.adminUsers': 'Benutzerverwaltung',
    'navigation.adminCategories': 'Kategorienverwaltung',
    'navigation.adminSla': 'SLA Konfiguration',
    'navigation.knowledgeAdmin': 'Wissen Verwaltung',
    'navigation.mainMenu': 'Hauptmenü',

    // Theme
    'theme.toggle': 'Thema wechseln',
    'theme.switchToDark': 'Zu dunklem Thema wechseln',
    'theme.switchToLight': 'Zu hellem Thema wechseln',
    'theme.switchToSystem': 'Zu Systemthema wechseln',

    // Dashboard
    'dashboard.welcome': 'Willkommen',
    'dashboard.totalTickets': 'Gesamt Tickets',
    'dashboard.avgResponseTime': 'Durchschn. Antwortzeit',
    'dashboard.avgResolutionTime': 'Durchschn. Lösungszeit',
    'dashboard.slaCompliance': 'SLA Einhaltung',
    'dashboard.customerSatisfaction': 'Kundenzufriedenheit',
    'dashboard.firstContactResolution': 'Erstkontakt-Lösung',
    'dashboard.activeAgents': 'Aktive Agenten',
    'dashboard.resolvedToday': 'Heute Gelöst',
    'dashboard.criticalPending': 'Kritisch Ausstehend',
    'dashboard.goal': 'Ziel',
    'dashboard.thisMonth': 'diesen Monat',
    'dashboard.available': 'Verfügbar',
    'dashboard.dailyGoal': 'Tagesziel',
    'dashboard.urgentAttention': 'Dringende Aufmerksamkeit',
    'dashboard.allGood': 'Alles gut',
    'dashboard.openTickets': 'Offene Tickets',
    'dashboard.resolvedTickets': 'Gelöste Tickets',
    'dashboard.closedTickets': 'Geschlossene Tickets',
    'dashboard.myTickets': 'Meine Tickets',
    'dashboard.assignedToMe': 'Mir Zugewiesen',
    'dashboard.overdueTickets': 'Überfällige Tickets',
    'dashboard.recentTickets': 'Aktuelle Tickets',
    'dashboard.lastTicketsCreated': 'Zuletzt erstellte Tickets',

    // Tickets
    'tickets.newTicket': 'Neues Ticket',
    'tickets.ticketNumber': 'Ticketnummer',
    'tickets.title': 'Titel',
    'tickets.description': 'Beschreibung',
    'tickets.priority': 'Priorität',
    'tickets.category': 'Kategorie',
    'tickets.assignedTo': 'Zugewiesen An',
    'tickets.createdBy': 'Erstellt Von',
    'tickets.createdAt': 'Erstellt Am',
    'tickets.updatedAt': 'Aktualisiert Am',
    'tickets.resolvedAt': 'Gelöst Am',
    'tickets.closedAt': 'Geschlossen Am',
    'tickets.resolution': 'Lösung',
    'tickets.comments': 'Kommentare',
    'tickets.addComment': 'Kommentar Hinzufügen',
    'tickets.untitled': 'Ohne Titel',
    'tickets.createdOn': 'Erstellt am {{date}}',
    'tickets.updatedOn': 'Aktualisiert am {{date}}',

    // Status
    'status.open': 'Offen',
    'status.pending': 'Ausstehend',
    'status.inProgress': 'In Bearbeitung',
    'status.resolved': 'Gelöst',
    'status.closed': 'Geschlossen',

    // Priority
    'priority.low': 'Niedrig',
    'priority.medium': 'Mittel',
    'priority.high': 'Hoch',
    'priority.urgent': 'Dringend',

    // Profile
    'profile.userProfile': 'Benutzerprofil',
    'profile.backToDashboard': 'Zurück zum Dashboard',
    'profile.personalInformation': 'Persönliche Informationen',
    'profile.preferences': 'Einstellungen',
    'profile.personalStatistics': 'Persönliche Statistiken',
    'profile.recentActivities': 'Aktuelle Aktivitäten',
    'profile.security': 'Sicherheit',
    'profile.editProfile': 'Profil Bearbeiten',
    'profile.changePassword': 'Passwort Ändern',
    'profile.savePreferences': 'Einstellungen Speichern',
    'profile.interfaceTheme': 'Interface Thema',
    'profile.language': 'Sprache',
    'profile.notifications': 'Benachrichtigungen',
    'profile.light': '☀️ Hell',
    'profile.dark': '🌙 Dunkel',
    'profile.system': '🖥️ System',
    'profile.english': '🇺🇸 English',
    'profile.portuguese': '🇧🇷 Português',
    'profile.spanish': '🇪🇸 Español',
    'profile.french': '🇫🇷 Français',
    'profile.dutch': '🇳🇱 Nederlands',
    'profile.german': '🇩🇪 Deutsch',

    // Auth
    'auth.login': 'Anmelden',
    'auth.register': 'Registrieren',
    'auth.logout': 'Abmelden',
    'auth.email': 'Email',
    'auth.password': 'Passwort',
    'auth.confirmPassword': 'Passwort bestätigen',
    'auth.forgotPassword': 'Passwort vergessen?',
    'auth.resetPassword': 'Passwort zurücksetzen',
    'auth.rememberMe': 'Angemeldet bleiben',
    'auth.signIn': 'Anmelden',
    'auth.signUp': 'Registrieren',
    'auth.signOut': 'Abmelden',
    'auth.welcomeBack': 'Willkommen zurück',
    'auth.loginInstructions': 'Melden Sie sich an, um auf das System zuzugreifen',
    'auth.enterCredentials': 'Geben Sie Ihre Anmeldedaten ein, um auf Ihr Konto zuzugreifen',
    'auth.emailPlaceholder': 'ihre@email.com',
    'auth.passwordPlaceholder': 'Geben Sie Ihr Passwort ein',
    'auth.loggingIn': 'Anmelden...',
    'auth.fullName': 'Vollständiger Name',
    'auth.fullNamePlaceholder': 'Ihr vollständiger Name',

    // Messages
    'messages.profileUpdated': 'Profil erfolgreich aktualisiert!',
    'messages.passwordChanged': 'Passwort erfolgreich geändert!',
    'messages.preferencesUpdated': 'Einstellungen erfolgreich gespeichert!',
    'messages.errorUpdatingProfile': 'Fehler beim Aktualisieren des Profils',
    'messages.errorChangingPassword': 'Fehler beim Ändern des Passworts',
    'messages.errorSavingPreferences': 'Fehler beim Speichern der Einstellungen',
    'messages.passwordsDoNotMatch': 'Passwörter stimmen nicht überein',
    'messages.passwordTooShort': 'Passwort muss mindestens 6 Zeichen lang sein',
    'messages.errorLoadingProfile': 'Fehler beim Laden der Profildaten'
  }
};

class NewLanguageCreator {
  constructor() {
    this.sourceTranslations = {};
    this.newLanguageFiles = {};
  }

  async run() {
    console.log('🌍 Creating new language files...\n');
    
    try {
      // Load source translations (English)
      await this.loadSourceTranslations();
      
      // Create new language files
      await this.createNewLanguageFiles();
      
      // Save new language files
      await this.saveNewLanguageFiles();
      
      // Update i18n configuration
      await this.updateI18nConfiguration();
      
      console.log('\n✅ New language files created successfully!');
      console.log('📝 Don\'t forget to update the language selector in the UI');
      
    } catch (error) {
      console.error('❌ Error creating new language files:', error);
      process.exit(1);
    }
  }

  async loadSourceTranslations() {
    console.log(`📚 Loading source translations (${CONFIG.sourceLocale})...`);
    
    const sourceFile = path.join(CONFIG.translationDir, `${CONFIG.sourceLocale}.json`);
    
    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Source translation file not found: ${sourceFile}`);
    }
    
    const content = fs.readFileSync(sourceFile, 'utf8');
    this.sourceTranslations = JSON.parse(content);
    
    const keyCount = this.countKeys(this.sourceTranslations);
    console.log(`  ✓ Loaded ${keyCount} keys from ${CONFIG.sourceLocale}`);
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

  async createNewLanguageFiles() {
    console.log('\n🔧 Creating new language files...');
    
    for (const locale of CONFIG.newLocales) {
      console.log(`\n  📝 Creating ${locale}...`);
      
      // Start with a copy of the source structure
      const newTranslations = JSON.parse(JSON.stringify(this.sourceTranslations));
      
      // Apply base translations for this locale
      const baseTranslations = BASE_TRANSLATIONS[locale] || {};
      this.applyTranslations(newTranslations, baseTranslations);
      
      // For remaining untranslated keys, use English as fallback
      this.fillMissingWithFallback(newTranslations, this.sourceTranslations);
      
      this.newLanguageFiles[locale] = newTranslations;
      
      const translatedCount = this.countTranslatedKeys(newTranslations, baseTranslations);
      const totalCount = this.countKeys(newTranslations);
      const percentage = Math.round((translatedCount / totalCount) * 100);
      
      console.log(`    ✓ ${locale}: ${translatedCount}/${totalCount} keys translated (${percentage}%)`);
    }
  }

  applyTranslations(target, translations) {
    for (const [keyPath, value] of Object.entries(translations)) {
      this.setNestedKey(target, keyPath, value);
    }
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
    current[finalKey] = value;
  }

  fillMissingWithFallback(target, source, prefix = '') {
    for (const key in source) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof source[key] === 'object' && source[key] !== null) {
        if (!(key in target) || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.fillMissingWithFallback(target[key], source[key], fullKey);
      } else {
        // If the key doesn't exist in target, use the source value as fallback
        if (!(key in target)) {
          target[key] = source[key];
        }
      }
    }
  }

  countTranslatedKeys(translations, baseTranslations) {
    let count = 0;
    for (const keyPath of Object.keys(baseTranslations)) {
      if (this.getNestedKey(translations, keyPath) !== undefined) {
        count++;
      }
    }
    return count;
  }

  getNestedKey(obj, keyPath) {
    const keys = keyPath.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  async saveNewLanguageFiles() {
    console.log('\n💾 Saving new language files...');
    
    for (const [locale, translations] of Object.entries(this.newLanguageFiles)) {
      const filePath = path.join(CONFIG.translationDir, `${locale}.json`);
      const content = JSON.stringify(translations, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');
      
      const keyCount = this.countKeys(translations);
      console.log(`  ✓ Saved ${locale}: ${keyCount} keys`);
    }
  }

  async updateI18nConfiguration() {
    console.log('\n🔧 Updating i18n configuration...');
    
    const i18nConfigPath = path.join(__dirname, '../src/i18n/index.ts');
    
    if (!fs.existsSync(i18nConfigPath)) {
      console.warn('  ⚠️  i18n configuration file not found, skipping update');
      return;
    }
    
    let configContent = fs.readFileSync(i18nConfigPath, 'utf8');
    
    // Add imports for new languages
    const importSection = configContent.match(/(\/\/ Import translation files[\s\S]*?)(\/\/ Translation resources)/);
    if (importSection) {
      let imports = importSection[1];
      
      for (const locale of CONFIG.newLocales) {
        const importName = locale.replace('-', '');
        const importLine = `import ${importName} from './locales/${locale}.json';\n`;
        
        if (!imports.includes(importLine)) {
          imports += importLine;
        }
      }
      
      configContent = configContent.replace(importSection[1], imports);
    }
    
    // Add resources for new languages
    const resourcesSection = configContent.match(/(const resources = \{[\s\S]*?)(\};)/);
    if (resourcesSection) {
      let resources = resourcesSection[1];
      
      for (const locale of CONFIG.newLocales) {
        const importName = locale.replace('-', '');
        const resourceLine = `  '${locale}': { translation: ${importName} },\n`;
        
        if (!resources.includes(resourceLine)) {
          resources += resourceLine;
        }
      }
      
      configContent = configContent.replace(resourcesSection[1], resources);
    }
    
    fs.writeFileSync(i18nConfigPath, configContent, 'utf8');
    console.log('  ✓ Updated i18n configuration');
    
    // Show instructions for UI updates
    console.log('\n📝 Manual steps required:');
    console.log('  1. Update language selector in Profile component');
    console.log('  2. Add flag emojis for new languages');
    console.log('  3. Test language switching functionality');
    console.log('  4. Consider adding RTL support if needed');
  }
}

// Run the creator if this script is executed directly
if (require.main === module) {
  const creator = new NewLanguageCreator();
  creator.run().catch(console.error);
}

module.exports = NewLanguageCreator;