import { describe, it, expect } from 'vitest';
import { extractUsernameFromEmail, transformUserName } from '@/lib/utils';

describe('extractUsernameFromEmail', () => {
  it('should extract username from valid email', () => {
    expect(extractUsernameFromEmail('john.doe@example.com')).toBe('john.doe');
    expect(extractUsernameFromEmail('user123@domain.org')).toBe('user123');
    expect(extractUsernameFromEmail('test@test.co.uk')).toBe('test');
  });

  it('should handle emails with special characters', () => {
    expect(extractUsernameFromEmail('user+tag@example.com')).toBe('user+tag');
    expect(extractUsernameFromEmail('user.name+tag@example.com')).toBe('user.name+tag');
    expect(extractUsernameFromEmail('user_123@example.com')).toBe('user_123');
  });

  it('should return empty string for invalid emails', () => {
    expect(extractUsernameFromEmail('invalid-email')).toBe('');
    expect(extractUsernameFromEmail('@example.com')).toBe('');
    expect(extractUsernameFromEmail('user@')).toBe('user');
  });

  it('should handle edge cases', () => {
    expect(extractUsernameFromEmail('')).toBe('');
    expect(extractUsernameFromEmail('   ')).toBe('');
    expect(extractUsernameFromEmail('user@@example.com')).toBe('user');
  });

  it('should handle null and undefined inputs', () => {
    expect(extractUsernameFromEmail(null as any)).toBe('');
    expect(extractUsernameFromEmail(undefined as any)).toBe('');
  });

  it('should handle non-string inputs', () => {
    expect(extractUsernameFromEmail(123 as any)).toBe('');
    expect(extractUsernameFromEmail({} as any)).toBe('');
    expect(extractUsernameFromEmail([] as any)).toBe('');
  });
});

describe('transformUserName', () => {
  describe('Priority 1: Full name handling', () => {
    it('should use full_name when available and not empty', () => {
      expect(transformUserName('John Doe', 'john@example.com')).toBe('John Doe');
      expect(transformUserName('Jane Smith', 'jane@example.com')).toBe('Jane Smith');
      expect(transformUserName('Single Name', 'user@example.com')).toBe('Single Name');
    });

    it('should trim whitespace from full_name', () => {
      expect(transformUserName('  John Doe  ', 'john@example.com')).toBe('John Doe');
      expect(transformUserName('\t Jane Smith \n', 'jane@example.com')).toBe('Jane Smith');
    });

    it('should handle full_name with special characters', () => {
      expect(transformUserName('José María', 'jose@example.com')).toBe('José María');
      expect(transformUserName("O'Connor", 'oconnor@example.com')).toBe("O'Connor");
      expect(transformUserName('Jean-Pierre', 'jean@example.com')).toBe('Jean-Pierre');
    });
  });

  describe('Priority 2: Email username fallback', () => {
    it('should extract username from email when full_name is empty', () => {
      expect(transformUserName('', 'john.doe@example.com')).toBe('john.doe');
      expect(transformUserName(null, 'user123@domain.org')).toBe('user123');
      expect(transformUserName(undefined, 'test@test.co.uk')).toBe('test');
    });

    it('should extract username when full_name is only whitespace', () => {
      expect(transformUserName('   ', 'john.doe@example.com')).toBe('john.doe');
      expect(transformUserName('\t\n', 'user123@domain.org')).toBe('user123');
    });

    it('should handle email usernames with special characters', () => {
      expect(transformUserName('', 'user+tag@example.com')).toBe('user+tag');
      expect(transformUserName(null, 'user.name+tag@example.com')).toBe('user.name+tag');
      expect(transformUserName(undefined, 'user_123@example.com')).toBe('user_123');
    });
  });

  describe('Priority 3: Final fallback', () => {
    it('should return "No name provided" when both full_name and email are invalid', () => {
      expect(transformUserName('', '')).toBe('No name provided');
      expect(transformUserName(null, null)).toBe('No name provided');
      expect(transformUserName(undefined, undefined)).toBe('No name provided');
    });

    it('should return "No name provided" when email is invalid', () => {
      expect(transformUserName('', 'invalid-email')).toBe('No name provided');
      expect(transformUserName(null, '@example.com')).toBe('No name provided');
      expect(transformUserName(undefined, 'user@')).toBe('user');
    });

    it('should return "No name provided" when email is missing', () => {
      expect(transformUserName('')).toBe('No name provided');
      expect(transformUserName(null)).toBe('No name provided');
      expect(transformUserName(undefined)).toBe('No name provided');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle non-string full_name inputs', () => {
      expect(transformUserName(123 as any, 'user@example.com')).toBe('user');
      expect(transformUserName({} as any, 'user@example.com')).toBe('user');
      expect(transformUserName([] as any, 'user@example.com')).toBe('user');
    });

    it('should handle non-string email inputs', () => {
      expect(transformUserName('John Doe', 123 as any)).toBe('John Doe');
      expect(transformUserName('', 123 as any)).toBe('No name provided');
      expect(transformUserName(null, {} as any)).toBe('No name provided');
    });

    it('should prioritize full_name over email username', () => {
      expect(transformUserName('John Doe', 'different.user@example.com')).toBe('John Doe');
      expect(transformUserName('Jane Smith', 'jane123@example.com')).toBe('Jane Smith');
    });

    it('should handle empty strings vs null/undefined consistently', () => {
      expect(transformUserName('', 'user@example.com')).toBe('user');
      expect(transformUserName(null, 'user@example.com')).toBe('user');
      expect(transformUserName(undefined, 'user@example.com')).toBe('user');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical database scenarios', () => {
      // User with complete profile
      expect(transformUserName('John Doe', 'john.doe@company.com')).toBe('John Doe');
      
      // User with only email (new registration)
      expect(transformUserName(null, 'new.user@company.com')).toBe('new.user');
      
      // User with empty name field
      expect(transformUserName('', 'empty.name@company.com')).toBe('empty.name');
      
      // User with whitespace-only name
      expect(transformUserName('   ', 'whitespace@company.com')).toBe('whitespace');
    });

    it('should handle international names and emails', () => {
      expect(transformUserName('María José García', 'maria@empresa.es')).toBe('María José García');
      expect(transformUserName('', 'josé.maría@empresa.es')).toBe('josé.maría');
      expect(transformUserName(null, 'andré@société.fr')).toBe('andré');
    });

    it('should handle corporate email patterns', () => {
      expect(transformUserName('', 'firstname.lastname@company.com')).toBe('firstname.lastname');
      expect(transformUserName(null, 'f.lastname@company.com')).toBe('f.lastname');
      expect(transformUserName(undefined, 'employee123@company.com')).toBe('employee123');
    });
  });
});