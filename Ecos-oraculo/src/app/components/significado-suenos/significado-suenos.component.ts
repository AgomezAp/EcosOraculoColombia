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
import {
  ConversationMessage,
  DreamInterpreterData,
  InterpretadorSuenosService,
} from '../../services/interpretador-suenos.service';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MercadopagoService } from '../../services/mercadopago.service';
import { HttpClient } from '@angular/common/http';
import {
  RecolectaDatosComponent,
  ServiceConfig,
} from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';

@Component({
  selector: 'app-significado-suenos',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './significado-suenos.component.html',
  styleUrl: './significado-suenos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignificadoSuenosComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messageText: string = '';
  messageInput = new FormControl('');
  messages: ConversationMessage[] = [];
  isLoading = false;
  isTyping = false;
  hasStartedConversation = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // ✅ Configuración del servicio para MercadoPago
  dreamServiceConfig: ServiceConfig = {
    serviceId: '2', // ID del servicio significado de sueños en el backend
    serviceName: 'Significado de Sueños',
    amount: 18000, // $18,000 COP (equivalente a ~4 EUR)
    description: 'Acceso completo a interpretaciones de sueños ilimitadas',
  };

  // Variables para control de pagos (MercadoPago)
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForDreams: boolean = false;

  // ✅ Contador de mensajes del usuario para lógica del 2do mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 4;

  // Propiedad para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  textareaHeight: number = 25;
  private readonly minTextareaHeight = 45;
  private readonly maxTextareaHeight = 120;
  private backendUrl = environment.apiUrl;

  interpreterData: DreamInterpreterData = {
    name: 'Maestra Alma',
    specialty: 'Interpretación de sueños y simbología onírica',
    experience: 'Siglos de interpretación de mensajes del subconsciente',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Ah, veo que has venido para descifrar los misterios de tu mundo onírico... Los sueños son ventanas al alma. Cuéntame, ¿qué visiones te han visitado?',
    'Las energías cósmicas me susurran que tienes sueños que deben ser interpretados. Soy la Maestra Alma, guardiana de los secretos oníricos. ¿Qué mensaje del subconsciente te preocupa?',
    'Bienvenido, viajero de los sueños. Los planos astrales me han mostrado tu llegada. Déjame guiarte a través de los símbolos y misterios de tus visiones nocturnas.',
    'El cristal de los sueños brilla con tu presencia... Siento que llevas visiones que deben ser descifradas. Confía en mi antigua sabiduría y comparte tus sueños conmigo.',
  ];

  constructor(
    private dreamService: InterpretadorSuenosService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private mercadopagoService: MercadopagoService
  ) {}

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.66);
  }

  async ngOnInit(): Promise<void> {
    console.log('🌙 ====== INICIANDO SIGNIFICADO DE SUEÑOS ======');

    // ✅ PASO 1: Verificar si ya está pagado
    this.hasUserPaidForDreams =
      sessionStorage.getItem('hasUserPaidForDreams_traumdeutung') === 'true' ||
      this.mercadopagoService.isServicePaid('1');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForDreams);

    // ✅ PASO 2: Verificar si viene de MercadoPago
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');
        console.log('  - Payment ID:', paymentStatus.paymentId);
        console.log('  - Service ID:', paymentStatus.serviceId);

        // Guardar estado de pago
        this.hasUserPaidForDreams = true;
        sessionStorage.setItem('hasUserPaidForDreams_traumdeutung', 'true');
        this.mercadopagoService.saveServicePaymentStatus('1', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('dreamBlockedMessageId');

        // Recuperar datos guardados antes del pago
        const savedData = this.mercadopagoService.getPaymentData();
        if (savedData) {
          console.log('📦 Recuperando datos guardados:', savedData);

          // Recuperar mensajes del chat
          if (
            savedData.conversationHistory &&
            savedData.conversationHistory.length > 0
          ) {
            this.messages = savedData.conversationHistory.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
            this.hasStartedConversation = true;
            console.log('💬 Mensajes recuperados:', this.messages.length);
          }

          // Recuperar contador de mensajes
          if (savedData.userMessageCount !== undefined) {
            this.userMessageCount = savedData.userMessageCount;
          }

          // Recuperar datos de usuario
          if (savedData.userData) {
            this.userData = savedData.userData;
            sessionStorage.setItem(
              'userData',
              JSON.stringify(savedData.userData)
            );
          }
        }

        // Limpiar datos de pago temporal
        this.mercadopagoService.clearPaymentData();

        // Limpiar parámetros de la URL
        this.mercadopagoService.cleanPaymentParamsFromUrl();

        // Agregar mensaje de confirmación de pago
        const successMessage: ConversationMessage = {
          role: 'interpreter',
          message: `✨ **¡Pago confirmado exitosamente!** ✨

🌙 Ahora tienes acceso completo e ilimitado a mis servicios de interpretación de sueños.

Los misterios del mundo onírico se revelan ante ti. Puedes preguntarme lo que desees sobre tus sueños, símbolos, visiones nocturnas y todos los secretos que tu subconsciente guarda para ti.

¿Qué sueño quieres que interprete?`,
          timestamp: new Date(),
        };
        this.messages.push(successMessage);
        this.saveMessagesToSession();

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem('pendingDreamMessage');
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingDreamMessage');
          setTimeout(() => {
            this.processUserMessage(pendingMessage);
          }, 2000);
        }

        this.cdr.markForCheck();
        return;
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        const pendingMessage: ConversationMessage = {
          role: 'interpreter',
          message:
            '⏳ Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          timestamp: new Date(),
        };
        this.messages.push(pendingMessage);
        this.mercadopagoService.cleanPaymentParamsFromUrl();
      } else if (
        paymentStatus.status === 'rejected' ||
        paymentStatus.status === 'failure'
      ) {
        console.log('❌ Pago rechazado o fallido');
        this.paymentError =
          'El pago no se pudo completar. Por favor, intenta nuevamente.';
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
    if (this.messages.length === 0) {
      this.loadDreamData();
    }

    // ✅ PASO 5: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForDreams && this.blockedMessageId) {
      console.log('🔓 Desbloqueando mensajes (usuario ya pagó)');
      this.blockedMessageId = null;
      sessionStorage.removeItem('dreamBlockedMessageId');
    }

    console.log('🌙 ====== INICIALIZACIÓN COMPLETADA ======');
    console.log('  - Usuario pagó:', this.hasUserPaidForDreams);
    console.log('  - Mensajes:', this.messages.length);
    console.log('  - Contador mensajes usuario:', this.userMessageCount);

    this.cdr.markForCheck();
  }

  private loadDreamData(): void {
    const savedMessages = sessionStorage.getItem('dreamMessages');
    const savedMessageCount = sessionStorage.getItem('dreamUserMessageCount');
    const savedBlockedMessageId = sessionStorage.getItem(
      'dreamBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.messages = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.userMessageCount = parseInt(savedMessageCount || '0');
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
        this.lastMessageCount = this.messages.length;
        console.log('💬 Mensajes cargados de sesión:', this.messages.length);
      } catch (error) {
        console.error('Error parseando mensajes:', error);
        this.clearSessionData();
        this.initializeWelcomeMessage();
      }
    } else {
      this.initializeWelcomeMessage();
    }
  }

  private initializeWelcomeMessage(): void {
    this.userMessageCount = 0;
    sessionStorage.setItem('dreamUserMessageCount', '0');

    const randomWelcome =
      this.welcomeMessages[
        Math.floor(Math.random() * this.welcomeMessages.length)
      ];

    const welcomeMessage: ConversationMessage = {
      role: 'interpreter',
      message: randomWelcome,
      timestamp: new Date(),
    };

    this.messages.push(welcomeMessage);
    this.hasStartedConversation = true;
  }

  private setVideosSpeed(rate: number): void {
    const host = this.elRef.nativeElement;
    const videos = host.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((v: any) => {
      const apply = () => (v.playbackRate = rate);
      if (v.readyState >= 1) apply();
      else v.addEventListener('loadedmetadata', apply, { once: true });
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.messages.length > this.lastMessageCount) {
      this.scrollToBottom();
      this.lastMessageCount = this.messages.length;
    }
  }

  onScroll(event: any): void {
    const element = event.target;
    const threshold = 50;
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;
    this.shouldAutoScroll = isNearBottom;
  }

  ngOnDestroy(): void {
    // Cleanup si es necesario
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  startConversation(): void {
    if (this.messages.length === 0) {
      this.initializeWelcomeMessage();
    }
    this.hasStartedConversation = true;
  }

  // ========== MÉTODOS DE ENVÍO DE MENSAJES ==========

  sendMessage(): void {
    if (!this.messageText?.trim() || this.isLoading) return;

    const userMessage = this.messageText.trim();

    console.log('📤 Enviando mensaje...');
    console.log('  - Usuario pagó:', this.hasUserPaidForDreams);
    console.log('  - Contador mensajes:', this.userMessageCount);

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForDreams) {
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
      sessionStorage.setItem('pendingDreamMessage', userMessage);

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
    sessionStorage.setItem(
      'dreamUserMessageCount',
      this.userMessageCount.toString()
    );

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.messageText = '';
    this.isTyping = true;
    this.isLoading = true;

    const conversationHistory = this.messages.slice(0, -1);

    this.dreamService
      .chatWithInterpreter({
        interpreterData: this.interpreterData,
        userMessage: userMessage,
        conversationHistory: conversationHistory,
      })
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.isTyping = false;
          this.shouldAutoScroll = true;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            const interpreterMsg: ConversationMessage = {
              role: 'interpreter',
              message: response.response,
              timestamp: new Date(),
              id: messageId,
            };
            this.messages.push(interpreterMsg);

            // ✅ Verificar si debe bloquear después del 2do mensaje
            if (
              !this.hasUserPaidForDreams &&
              this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
            ) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('dreamBlockedMessageId', messageId);

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
          } else {
            this.handleError('Error al obtener la respuesta del intérprete');
          }
        },
        error: (error: any) => {
          console.error('Error en chat:', error);
          this.isLoading = false;
          this.isTyping = false;
          this.handleError('Error de conexión. Por favor, inténtalo de nuevo.');
          this.cdr.markForCheck();
        },
      });
  }

  // ========== MÉTODOS DE GUARDADO Y SESIÓN ==========

  private saveStateBeforePayment(): void {
    console.log('💾 Guardando estado antes del pago...');

    this.saveMessagesToSession();

    sessionStorage.setItem(
      'dreamUserMessageCount',
      this.userMessageCount.toString()
    );

    if (this.blockedMessageId) {
      sessionStorage.setItem('dreamBlockedMessageId', this.blockedMessageId);
    }

    // Guardar datos para MercadoPago
    const paymentData = {
      conversationHistory: this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
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
      const messagesToSave = this.messages.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem('dreamMessages', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('dreamMessages');
    sessionStorage.removeItem('dreamUserMessageCount');
    sessionStorage.removeItem('dreamBlockedMessageId');
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForDreams;
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

  adjustTextareaHeight(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, this.minTextareaHeight),
      this.maxTextareaHeight
    );
    this.textareaHeight = newHeight;
    textarea.style.height = newHeight + 'px';
  }

  newConsultation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForDreams) {
      this.userMessageCount = 0;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('dreamMessages');
      sessionStorage.removeItem('dreamUserMessageCount');
      sessionStorage.removeItem('dreamBlockedMessageId');
      this.userMessageCount = 0;
      this.blockedMessageId = null;
    }

    this.messages = [];
    this.hasStartedConversation = false;
    this.startConversation();
    this.cdr.markForCheck();
  }

  private handleError(errorMessage: string): void {
    const errorMsg: ConversationMessage = {
      role: 'interpreter',
      message: `🔮 Las energías cósmicas están perturbadas... ${errorMessage} Intenta de nuevo cuando las vibraciones se estabilicen.`,
      timestamp: new Date(),
    };
    this.messages.push(errorMsg);
    this.shouldAutoScroll = true;
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {}
  }

  clearConversation(): void {
    this.newConsultation();
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.messageText?.trim() && !this.isLoading) {
        this.sendMessage();
        setTimeout(() => {
          this.textareaHeight = this.minTextareaHeight;
        }, 50);
      }
    }
  }

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
}
