import { FormField, FormFieldCategory, FormFieldDetectionResult } from './formFieldDetector';

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  category: FormFieldCategory;
  priority: 'high' | 'medium' | 'low';
  formFields: FormField[];
  estimatedTime?: string;
  tips?: string[];
  required: boolean;
}

export interface TodoCategory {
  name: FormFieldCategory;
  icon: string;
  description: string;
  items: TodoItem[];
  completed: number;
  total: number;
  priority: number; // Lower number = higher priority
}

export interface TodoListResult {
  categories: TodoCategory[];
  totalItems: number;
  completedItems: number;
  progress: number; // 0-100
  estimatedTotalTime: string;
  nextAction?: TodoItem;
  success: boolean;
  error?: string;
}

// Category configuration with icons and priorities
const CATEGORY_CONFIG: Record<FormFieldCategory, {
  icon: string;
  description: string;
  priority: number;
  requiredByDefault: boolean;
}> = {
  'Personal Information': {
    icon: '👤',
    description: 'Basic personal details and identification',
    priority: 1,
    requiredByDefault: true
  },
  'Contact Information': {
    icon: '📞',
    description: 'Phone numbers, email addresses, and communication details',
    priority: 2,
    requiredByDefault: true
  },
  'Address Information': {
    icon: '🏠',
    description: 'Home, mailing, and billing addresses',
    priority: 3,
    requiredByDefault: true
  },
  'Employment History': {
    icon: '💼',
    description: 'Work experience, current employer, and job details',
    priority: 4,
    requiredByDefault: false
  },
  'Education': {
    icon: '🎓',
    description: 'Educational background and qualifications',
    priority: 5,
    requiredByDefault: false
  },
  'Financial Information': {
    icon: '💰',
    description: 'Income, banking, and financial details',
    priority: 6,
    requiredByDefault: false
  },
  'Emergency Contact': {
    icon: '🚨',
    description: 'Emergency contacts and next of kin information',
    priority: 7,
    requiredByDefault: true
  },
  'References': {
    icon: '📋',
    description: 'Professional and personal references',
    priority: 8,
    requiredByDefault: false
  },
  'Medical Information': {
    icon: '🏥',
    description: 'Health conditions, medications, and medical history',
    priority: 9,
    requiredByDefault: false
  },
  'Legal Information': {
    icon: '⚖️',
    description: 'Legal documents, agreements, and compliance',
    priority: 10,
    requiredByDefault: false
  },
  'Other': {
    icon: '📝',
    description: 'Additional information and miscellaneous fields',
    priority: 11,
    requiredByDefault: false
  }
};

// Field-specific tips for better completion
const FIELD_TIPS: Record<string, string[]> = {
  'name': [
    'Use your legal name as it appears on official documents',
    'Double-check spelling to avoid processing delays'
  ],
  'email': [
    'Use a professional email address if this is for work or applications',
    'Make sure you have access to this email for verification'
  ],
  'phone': [
    'Include area code for phone numbers',
    'Provide a number where you can be reached during business hours'
  ],
  'address': [
    'Use your current residential address',
    'Include apartment/unit number if applicable',
    'Verify ZIP/postal code is correct'
  ],
  'date': [
    'Use MM/DD/YYYY format unless otherwise specified',
    'Double-check dates for accuracy'
  ],
  'number': [
    'Enter numbers without spaces or dashes unless required',
    'Keep sensitive numbers secure and private'
  ],
  'text': [
    'Be clear and concise in your response',
    'Proofread for spelling and grammar'
  ]
};

export class TodoGenerator {
  generateTodoList(detectionResult: FormFieldDetectionResult): TodoListResult {
    try {
      if (!detectionResult.success || detectionResult.fields.length === 0) {
        return {
          categories: [],
          totalItems: 0,
          completedItems: 0,
          progress: 0,
          estimatedTotalTime: '0 min',
          success: false,
          error: detectionResult.error || 'No form fields detected'
        };
      }

      const categories = this.createCategoriesFromFields(detectionResult.fieldsByCategory);
      const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
      const completedItems = categories.reduce((sum, cat) => sum + cat.completed, 0);
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      
      // Find next action (first pending item with highest priority category)
      const nextAction = this.findNextAction(categories);
      
      // Calculate estimated time
      const estimatedTotalTime = this.calculateEstimatedTime(categories);

      console.log(`Generated todo list: ${categories.length} categories, ${totalItems} items`);

      return {
        categories: categories.sort((a, b) => a.priority - b.priority),
        totalItems,
        completedItems,
        progress,
        estimatedTotalTime,
        nextAction,
        success: true
      };
    } catch (error) {
      console.error('Todo generation failed:', error);
      return {
        categories: [],
        totalItems: 0,
        completedItems: 0,
        progress: 0,
        estimatedTotalTime: '0 min',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private createCategoriesFromFields(fieldsByCategory: Record<FormFieldCategory, FormField[]>): TodoCategory[] {
    const categories: TodoCategory[] = [];

    for (const [categoryName, fields] of Object.entries(fieldsByCategory)) {
      if (fields.length === 0) continue;

      const category = categoryName as FormFieldCategory;
      const config = CATEGORY_CONFIG[category];
      
      // Group similar fields into todo items
      const todoItems = this.groupFieldsIntoTodoItems(fields, category);
      
      categories.push({
        name: category,
        icon: config.icon,
        description: config.description,
        items: todoItems,
        completed: todoItems.filter(item => item.status === 'completed').length,
        total: todoItems.length,
        priority: config.priority
      });
    }

    return categories;
  }

  private groupFieldsIntoTodoItems(fields: FormField[], category: FormFieldCategory): TodoItem[] {
    const todoItems: TodoItem[] = [];
    const processedFields = new Set<string>();

    // Group related fields together
    const fieldGroups = this.groupRelatedFields(fields);

    for (const group of fieldGroups) {
      if (group.fields.length === 0) continue;

      const primaryField = group.fields[0];
      const todoItem: TodoItem = {
        id: `todo-${category}-${primaryField.id}`,
        title: group.title,
        description: group.description,
        status: 'pending',
        category: category,
        priority: this.determinePriority(group.fields, category),
        formFields: group.fields,
        estimatedTime: this.estimateCompletionTime(group.fields),
        tips: this.getTipsForFields(group.fields),
        required: CATEGORY_CONFIG[category].requiredByDefault || group.fields.some(f => f.confidence > 0.8)
      };

      todoItems.push(todoItem);

      // Mark fields as processed
      group.fields.forEach(field => processedFields.add(field.id));
    }

    return todoItems.sort((a, b) => {
      // Sort by priority, then by required status, then by confidence
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.required !== b.required) return a.required ? -1 : 1;
      
      const aMaxConfidence = Math.max(...a.formFields.map(f => f.confidence));
      const bMaxConfidence = Math.max(...b.formFields.map(f => f.confidence));
      return bMaxConfidence - aMaxConfidence;
    });
  }

  private groupRelatedFields(fields: FormField[]): Array<{
    title: string;
    description: string;
    fields: FormField[];
  }> {
    const groups: Array<{
      title: string;
      description: string;
      fields: FormField[];
    }> = [];

    // Group by similar labels or types
    const fieldsByType = new Map<string, FormField[]>();

    for (const field of fields) {
      const groupKey = this.getGroupKey(field);
      if (!fieldsByType.has(groupKey)) {
        fieldsByType.set(groupKey, []);
      }
      fieldsByType.get(groupKey)!.push(field);
    }

    for (const [groupKey, groupFields] of Array.from(fieldsByType.entries())) {
      if (groupFields.length === 1) {
        // Single field
        const field = groupFields[0];
        groups.push({
          title: `Fill ${field.label}`,
          description: `Enter your ${field.label.toLowerCase()}`,
          fields: [field]
        });
      } else {
        // Multiple related fields
        groups.push({
          title: `Complete ${this.getGroupDisplayName(groupKey)} Information`,
          description: `Fill in ${groupFields.length} related fields: ${groupFields.map(f => f.label).join(', ')}`,
          fields: groupFields
        });
      }
    }

    return groups;
  }

  private getGroupKey(field: FormField): string {
    // Group similar field types together
    const label = field.label.toLowerCase();
    
    if (label.includes('name')) return 'name';
    if (label.includes('address') || label.includes('street') || label.includes('city') || label.includes('state') || label.includes('zip')) return 'address';
    if (label.includes('phone') || label.includes('email')) return 'contact';
    if (label.includes('date') || label.includes('birth')) return 'date';
    if (label.includes('employment') || label.includes('work') || label.includes('job')) return 'employment';
    if (label.includes('education') || label.includes('school') || label.includes('degree')) return 'education';
    
    return field.type;
  }

  private getGroupDisplayName(groupKey: string): string {
    const displayNames: Record<string, string> = {
      'name': 'Name',
      'address': 'Address',
      'contact': 'Contact',
      'date': 'Date',
      'employment': 'Employment',
      'education': 'Education',
      'text': 'Text',
      'number': 'Numeric',
      'email': 'Email',
      'phone': 'Phone'
    };
    
    return displayNames[groupKey] || 'Field';
  }

  private determinePriority(fields: FormField[], category: FormFieldCategory): 'high' | 'medium' | 'low' {
    const avgConfidence = fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length;
    const hasRequiredKeywords = fields.some(f => 
      f.keywords.some(k => ['required', 'mandatory', 'must'].includes(k.toLowerCase()))
    );

    if (hasRequiredKeywords || avgConfidence > 0.8) return 'high';
    if (avgConfidence > 0.6 || CATEGORY_CONFIG[category].requiredByDefault) return 'medium';
    return 'low';
  }

  private estimateCompletionTime(fields: FormField[]): string {
    // Estimate based on field complexity
    let minutes = 0;
    
    for (const field of fields) {
      switch (field.type) {
        case 'name':
        case 'email':
        case 'phone':
          minutes += 1;
          break;
        case 'address':
          minutes += 3;
          break;
        case 'date':
        case 'number':
          minutes += 2;
          break;
        case 'textarea':
          minutes += 5;
          break;
        default:
          minutes += 1;
      }
    }

    return `${Math.max(1, minutes)} min`;
  }

  private getTipsForFields(fields: FormField[]): string[] {
    const tips: string[] = [];
    const seenTips = new Set<string>();

    for (const field of fields) {
      const fieldTips = FIELD_TIPS[field.type] || [];
      for (const tip of fieldTips) {
        if (!seenTips.has(tip)) {
          tips.push(tip);
          seenTips.add(tip);
        }
      }
    }

    // Add general tips if no specific ones found
    if (tips.length === 0) {
      tips.push('Double-check your input for accuracy');
      tips.push('All required fields must be completed');
    }

    return tips.slice(0, 3); // Limit to 3 tips max
  }

  private findNextAction(categories: TodoCategory[]): TodoItem | undefined {
    for (const category of categories.sort((a, b) => a.priority - b.priority)) {
      const nextItem = category.items.find(item => item.status === 'pending');
      if (nextItem) return nextItem;
    }
    return undefined;
  }

  private calculateEstimatedTime(categories: TodoCategory[]): string {
    const totalMinutes = categories.reduce((sum, category) => {
      return sum + category.items
        .filter(item => item.status === 'pending')
        .reduce((itemSum, item) => {
          const minutes = parseInt(item.estimatedTime?.replace(' min', '') || '1');
          return itemSum + minutes;
        }, 0);
    }, 0);

    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }

  // Update todo item status
  updateTodoStatus(categories: TodoCategory[], todoId: string, status: TodoItem['status']): TodoCategory[] {
    return categories.map(category => ({
      ...category,
      items: category.items.map(item => 
        item.id === todoId ? { ...item, status } : item
      ),
      completed: category.items.filter(item => 
        item.id === todoId ? status === 'completed' : item.status === 'completed'
      ).length
    }));
  }

  // Get todo item by ID
  getTodoItem(categories: TodoCategory[], todoId: string): TodoItem | undefined {
    for (const category of categories) {
      const item = category.items.find(item => item.id === todoId);
      if (item) return item;
    }
    return undefined;
  }
}
