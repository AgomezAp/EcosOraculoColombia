import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import { MapaVocacionalService } from '../../services/mapa-vocacional.service';
import { MercadopagoService } from '../../services/mercadopago.service';
import { HttpClient } from '@angular/common/http';
import {
  RecolectaDatosComponent,
  ServiceConfig,
} from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';

interface ChatMessage {
  sender: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  id?: string;
}

interface AssessmentQuestion {
  id: number;
  question: string;
  options: Array<{
    value: string;
    label: string;
    category: string;
  }>;
}

interface AssessmentAnswer {
  question: string;
  answer: string;
  category: string;
}

interface PersonalInfo {
  age?: number;
  currentEducation?: string;
  workExperience?: string;
  interests?: string[];
}

@Component({
  selector: 'app-mapa-vocacional',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatRadioModule,
    MatStepperModule,
    MatProgressBarModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './mapa-vocacional.component.html',
  styleUrl: './mapa-vocacional.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaVocacionalComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  // Info del consejero
  counselorInfo = {
    name: 'Dra. Valeria',
    title: 'Especialista en Orientación Profesional',
    specialty: 'Orientación profesional y cartas de carrera personalizadas',
  };

  // Modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // ✅ Configuración del servicio para MercadoPago
  vocationalServiceConfig: ServiceConfig = {
    serviceId: '5', // ID del servicio mapa vocacional en el backend
    serviceName: 'Mapa Vocacional',
    amount: 18000, // $18,000 COP (equivalente a ~4 EUR)
    description: 'Acceso completo a orientación vocacional ilimitada',
  };

  // Estado de pestañas
  currentTab: 'chat' | 'assessment' | 'results' = 'chat';

  // Chat
  chatMessages: ChatMessage[] = [];
  currentMessage: string = '';
  isLoading: boolean = false;

  // Variables para auto-scroll
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Variables para control de pagos (MercadoPago)
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForVocational: boolean = false;

  // ✅ Contador de mensajes del usuario para lógica del 2do mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 4;

  // Propiedad para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  // Datos personales
  showPersonalForm: boolean = false;
  personalInfo: PersonalInfo = {};

  // Assessment
  assessmentQuestions: AssessmentQuestion[] = [];
  currentQuestionIndex: number = 0;
  selectedOption: string = '';
  assessmentAnswers: AssessmentAnswer[] = [];
  assessmentProgress: number = 0;
  hasAssessmentResults: boolean = false;
  assessmentResults: any = null;

  constructor(
    private vocationalService: MapaVocacionalService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private mercadopagoService: MercadopagoService
  ) {}

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.67);
  }

  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }

  async ngOnInit(): Promise<void> {
    console.log('🎯 ====== INICIANDO MAPA VOCACIONAL ======');

    // ✅ PASO 1: Verificar si ya está pagado
    this.hasUserPaidForVocational =
      sessionStorage.getItem('hasUserPaidForVocational_berufskarte') === 'true' ||
      this.mercadopagoService.isServicePaid('4');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForVocational);

    // ✅ PASO 2: Verificar si viene de MercadoPago
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');
        console.log('  - Payment ID:', paymentStatus.paymentId);
        console.log('  - Service ID:', paymentStatus.serviceId);

        // Guardar estado de pago
        this.hasUserPaidForVocational = true;
        sessionStorage.setItem('hasUserPaidForVocational_berufskarte', 'true');
        this.mercadopagoService.saveServicePaymentStatus('4', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('vocationalBlockedMessageId');

        // Recuperar datos guardados antes del pago
        const savedData = this.mercadopagoService.getPaymentData();
        if (savedData) {
          console.log('📦 Recuperando datos guardados:', savedData);

          // Recuperar mensajes del chat
          if (savedData.conversationHistory && savedData.conversationHistory.length > 0) {
            this.chatMessages = savedData.conversationHistory.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
            console.log('💬 Mensajes recuperados:', this.chatMessages.length);
          }

          // Recuperar contador de mensajes
          if (savedData.userMessageCount !== undefined) {
            this.userMessageCount = savedData.userMessageCount;
          }

          // Recuperar datos de usuario
          if (savedData.userData) {
            this.userData = savedData.userData;
            sessionStorage.setItem('userData', JSON.stringify(savedData.userData));
          }
        }

        // Limpiar datos de pago temporal
        this.mercadopagoService.clearPaymentData();

        // Limpiar parámetros de la URL
        this.mercadopagoService.cleanPaymentParamsFromUrl();

        // Agregar mensaje de confirmación de pago
        const successMessage: ChatMessage = {
          sender: this.counselorInfo.name,
          content: `✨ **¡Pago confirmado exitosamente!** ✨

🎯 Ahora tienes acceso completo e ilimitado a mis servicios de orientación vocacional.

Tu camino profesional está más claro que nunca. Puedes preguntarme lo que desees sobre tu vocación, carrera, habilidades profesionales y todas las oportunidades que el futuro laboral tiene para ti.

¿Qué aspecto de tu futuro profesional quieres explorar?`,
          timestamp: new Date(),
          isUser: false,
        };
        this.chatMessages.push(successMessage);
        this.saveMessagesToSession();

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem('pendingVocationalMessage');
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingVocationalMessage');
          setTimeout(() => {
            this.processUserMessage(pendingMessage);
          }, 2000);
        }

        this.cdr.markForCheck();
        return;
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        const pendingMessage: ChatMessage = {
          sender: this.counselorInfo.name,
          content: '⏳ Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          timestamp: new Date(),
          isUser: false,
        };
        this.chatMessages.push(pendingMessage);
        this.mercadopagoService.cleanPaymentParamsFromUrl();
      } else if (paymentStatus.status === 'rejected' || paymentStatus.status === 'failure') {
        console.log('❌ Pago rechazado o fallido');
        this.paymentError = 'El pago no se pudo completar. Por favor, intenta nuevamente.';
        this.mercadopagoService.cleanPaymentParamsFromUrl();
      }
    }

    // ✅ PASO 3: Cargar datos del usuario desde sessionStorage
    const savedUserData = sessionStorage.getItem('userData');
    if (savedUserData) {
      try {
        this.userData = JSON.parse(savedUserData);
      } catch (error) {
        this.userData = null;
      }
    }

    // ✅ PASO 4: Cargar mensajes guardados
    if (this.chatMessages.length === 0) {
      this.loadVocationalData();
    }

    // ✅ PASO 5: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForVocational && this.blockedMessageId) {
      console.log('🔓 Desbloqueando mensajes (usuario ya pagó)');
      this.blockedMessageId = null;
      sessionStorage.removeItem('vocationalBlockedMessageId');
    }

    // Cargar preguntas del assessment
    this.loadAssessmentQuestions();

    console.log('🎯 ====== INICIALIZACIÓN COMPLETADA ======');
    console.log('  - Usuario pagó:', this.hasUserPaidForVocational);
    console.log('  - Mensajes:', this.chatMessages.length);
    console.log('  - Contador mensajes usuario:', this.userMessageCount);

    this.cdr.markForCheck();
  }

  private loadVocationalData(): void {
    const savedMessages = sessionStorage.getItem('vocationalMessages');
    const savedMessageCount = sessionStorage.getItem('vocationalUserMessageCount');
    const savedBlockedMessageId = sessionStorage.getItem('vocationalBlockedMessageId');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.chatMessages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.userMessageCount = parseInt(savedMessageCount || '0');
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.chatMessages.length;
        console.log('💬 Mensajes cargados de sesión:', this.chatMessages.length);
      } catch (error) {
        console.error('Error parseando mensajes:', error);
        this.clearSessionData();
        this.initializeWelcomeMessage();
      }
    } else {
      this.initializeWelcomeMessage();
    }
  }

  // Métodos para control de scroll
  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.chatMessages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.chatMessages.length;
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50;
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    this.shouldAutoScroll = isNearBottom;
  }

  ngOnDestroy(): void {
    // Cleanup si es necesario
  }

  // Inicializar mensaje de bienvenida
  initializeWelcomeMessage(): void {
    this.userMessageCount = 0;
    sessionStorage.setItem('vocationalUserMessageCount', '0');

    this.addMessage({
      sender: this.counselorInfo.name,
      content: `¡Hola! Soy ${this.counselorInfo.name}, tu especialista en Orientación Profesional. Estoy aquí para ayudarte a descubrir tu verdadera vocación y diseñar una carta de carrera personalizada para ti.`,
      timestamp: new Date(),
      isUser: false,
    });
  }

  // Cambiar pestaña
  switchTab(tab: 'chat' | 'assessment' | 'results'): void {
    this.currentTab = tab;
  }

  // ========== MÉTODOS DE ENVÍO DE MENSAJES ==========

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    console.log('📤 Enviando mensaje...');
    console.log('  - Usuario pagó:', this.hasUserPaidForVocational);
    console.log('  - Contador mensajes:', this.userMessageCount);

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForVocational) {
      console.log('✅ Usuario tiene acceso completo, procesando mensaje...');
      this.shouldAutoScroll = true;
      this.processUserMessage(userMessage);
      return;
    }

    // ✅ Verificar si es el 2do mensaje o posterior (requiere pago)
    if (this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT - 1) {
      console.log(`🔒 Mensaje #${this.userMessageCount + 1} - Requiere pago`);

      // Cerrar otros modales
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingVocationalMessage', userMessage);

      // Guardar estado antes del pago
      this.saveStateBeforePayment();

      // Mostrar modal de datos
      setTimeout(() => {
        this.showDataModal = true;
        this.cdr.markForCheck();
      }, 100);

      return;
    }

    // Procesar mensaje normalmente (primer mensaje gratuito)
    this.shouldAutoScroll = true;
    this.processUserMessage(userMessage);
  }

  private processUserMessage(userMessage: string): void {
    // Incrementar contador de mensajes del usuario
    this.userMessageCount++;
    sessionStorage.setItem('vocationalUserMessageCount', this.userMessageCount.toString());

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    this.addMessage({
      sender: 'Tú',
      content: userMessage,
      timestamp: new Date(),
      isUser: true,
    });

    this.currentMessage = '';
    this.isLoading = true;

    // Preparar historial de conversación
    const conversationHistory = this.chatMessages.slice(-10).map((msg) => ({
      role: msg.isUser ? ('user' as const) : ('counselor' as const),
      message: msg.content,
    }));

    // Enviar al servicio
    this.vocationalService
      .sendMessage(
        userMessage,
        this.personalInfo,
        this.assessmentAnswers,
        conversationHistory
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.shouldAutoScroll = true;

          const messageId = Date.now().toString();

          this.addMessage({
            sender: this.counselorInfo.name,
            content: response,
            timestamp: new Date(),
            isUser: false,
            id: messageId,
          });

          // ✅ Verificar si debe bloquear después del 2do mensaje
          if (
            !this.hasUserPaidForVocational &&
            this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
          ) {
            this.blockedMessageId = messageId;
            sessionStorage.setItem('vocationalBlockedMessageId', messageId);

            // Mostrar modal de pago después de 2 segundos
            setTimeout(() => {
              this.saveStateBeforePayment();
              this.showPaymentModal = false;

              setTimeout(() => {
                this.showDataModal = true;
                this.cdr.markForCheck();
              }, 100);
            }, 2000);
          }

          this.saveMessagesToSession();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error en chat:', error);
          this.isLoading = false;
          this.addMessage({
            sender: this.counselorInfo.name,
            content:
              'Disculpa, estoy experimentando dificultades técnicas. ¿Podrías reformular tu pregunta?',
            timestamp: new Date(),
            isUser: false,
          });
          this.saveMessagesToSession();
          this.cdr.markForCheck();
        },
      });
  }

  // ========== MÉTODOS DE GUARDADO Y SESIÓN ==========

  private saveStateBeforePayment(): void {
    console.log('💾 Guardando estado antes del pago...');

    this.saveMessagesToSession();

    sessionStorage.setItem('vocationalUserMessageCount', this.userMessageCount.toString());

    if (this.blockedMessageId) {
      sessionStorage.setItem('vocationalBlockedMessageId', this.blockedMessageId);
    }

    // Guardar datos para MercadoPago
    const paymentData = {
      conversationHistory: this.chatMessages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
      })),
      userMessageCount: this.userMessageCount,
      userData: this.userData,
      blockedMessageId: this.blockedMessageId,
      timestamp: new Date().toISOString(),
    };

    this.mercadopagoService.savePaymentData(paymentData);
    console.log('✅ Estado guardado para recuperar después del pago');
  }

  private saveMessagesToSession(): void {
    try {
      const messagesToSave = this.chatMessages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
      }));
      sessionStorage.setItem('vocationalMessages', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('vocationalMessages');
    sessionStorage.removeItem('vocationalUserMessageCount');
    sessionStorage.removeItem('vocationalBlockedMessageId');
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForVocational;
  }

  // ========== MÉTODOS DE PAGO (MERCADOPAGO) ==========

  onUserDataSubmitted(userData: any): void {
    console.log('📋 Datos del usuario recibidos:', userData);

    // Guardar datos
    this.userData = userData;
    sessionStorage.setItem('userData', JSON.stringify(userData));

    // El modal ya maneja la redirección a MercadoPago
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  onDataModalClosed(): void {
    this.showDataModal = false;
    this.cdr.markForCheck();
  }

  cancelPayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  // ========== MÉTODOS DE UTILIDAD ==========

  getTimeString(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'N/A';
    }
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  addMessage(message: ChatMessage): void {
    this.chatMessages.push(message);
    this.shouldAutoScroll = true;
    setTimeout(() => this.scrollToBottom(), 100);
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    // Convertir **texto** a <strong>texto</strong> para negrilla
    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Convertir saltos de línea a <br>
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    // Manejar *texto* como cursiva
    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  // Personal info methods
  togglePersonalForm(): void {
    this.showPersonalForm = !this.showPersonalForm;
  }

  savePersonalInfo(): void {
    this.showPersonalForm = false;

    if (Object.keys(this.personalInfo).length > 0) {
      this.addMessage({
        sender: this.counselorInfo.name,
        content: `Perfecto, he registrado tu información personal. Esto me ayudará a brindarte una orientación más precisa y personalizada. ¿Hay algo específico sobre tu futuro profesional que te preocupe o entusiasme?`,
        timestamp: new Date(),
        isUser: false,
      });
    }
  }

  // Assessment methods
  loadAssessmentQuestions(): void {
    this.vocationalService.getAssessmentQuestions().subscribe({
      next: (questions) => {
        this.assessmentQuestions = questions;
        this.updateProgress();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error cargando preguntas:', error);
        this.cdr.markForCheck();
      },
    });
  }

  get currentQuestion(): AssessmentQuestion | null {
    return this.assessmentQuestions[this.currentQuestionIndex] || null;
  }

  selectOption(option: any): void {
    this.selectedOption = option.value;
  }

  nextQuestion(): void {
    if (this.selectedOption && this.currentQuestion) {
      this.assessmentAnswers[this.currentQuestionIndex] = {
        question: this.currentQuestion.question,
        answer: this.selectedOption,
        category:
          this.currentQuestion.options.find(
            (o: any) => o.value === this.selectedOption
          )?.category || '',
      };

      this.currentQuestionIndex++;
      this.selectedOption = '';
      this.updateProgress();
    }
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      const savedAnswer = this.assessmentAnswers[this.currentQuestionIndex];
      this.selectedOption = savedAnswer ? savedAnswer.answer : '';
      this.updateProgress();
    }
  }

  updateProgress(): void {
    if (this.assessmentQuestions.length > 0) {
      this.assessmentProgress =
        ((this.currentQuestionIndex + 1) / this.assessmentQuestions.length) * 100;
    }
  }

  finishAssessment(): void {
    if (this.selectedOption && this.currentQuestion) {
      this.assessmentAnswers[this.currentQuestionIndex] = {
        question: this.currentQuestion.question,
        answer: this.selectedOption,
        category:
          this.currentQuestion.options.find(
            (o: any) => o.value === this.selectedOption
          )?.category || '',
      };

      this.analyzeResults();
    }
  }

  analyzeResults(): void {
    this.vocationalService.analyzeAssessment(this.assessmentAnswers).subscribe({
      next: (results) => {
        this.assessmentResults = results;
        this.hasAssessmentResults = true;
        this.switchTab('results');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error analizando resultados:', error);
        this.cdr.markForCheck();
      },
    });
  }

  startNewAssessment(): void {
    this.currentQuestionIndex = 0;
    this.selectedOption = '';
    this.assessmentAnswers = [];
    this.assessmentProgress = 0;
    this.assessmentResults = null;
    this.hasAssessmentResults = false;
    this.updateProgress();
    this.switchTab('assessment');
  }

  getCategoryEmoji(category: string): string {
    return this.vocationalService.getCategoryEmoji(category);
  }

  getCategoryColor(category: string): string {
    return this.vocationalService.getCategoryColor(category);
  }

  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {}
  }

  resetChat(): void {
    // 1. Reset de arrays y mensajes
    this.chatMessages = [];
    this.currentMessage = '';

    // 2. Reset de estados de carga
    this.isLoading = false;

    // 3. Reset de estados de pago y bloqueo
    this.userMessageCount = 0;
    this.blockedMessageId = null;

    // 4. Reset de modales
    this.showPaymentModal = false;
    this.showDataModal = false;
    this.showPersonalForm = false;

    // 5. Reset de variables de scroll y contadores
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    // 6. Reset del assessment
    this.currentQuestionIndex = 0;
    this.selectedOption = '';
    this.assessmentAnswers = [];
    this.assessmentProgress = 0;
    this.assessmentResults = null;
    this.hasAssessmentResults = false;

    // 7. Reset de información personal
    this.personalInfo = {};

    // 8. Reset de payment
    this.isProcessingPayment = false;
    this.paymentError = null;

    // 9. Limpiar sessionStorage específico vocacional (pero NO userData)
    sessionStorage.removeItem('vocationalMessages');
    sessionStorage.removeItem('vocationalUserMessageCount');
    sessionStorage.removeItem('vocationalBlockedMessageId');
    sessionStorage.removeItem('pendingVocationalMessage');

    // 10. Reset a pestaña principal
    this.currentTab = 'chat';

    // 11. Reinicializar mensaje de bienvenida
    this.initializeWelcomeMessage();
    this.cdr.markForCheck();
  }
}