import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { NumerologiaService } from '../../services/numerologia.service';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
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

interface ConversationMessage {
  role: 'user' | 'numerologist';
  message: string;
  timestamp: Date;
  id?: string;
}

@Component({
  selector: 'app-historia-sagrada',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RecolectaDatosComponent,
  ],
  templateUrl: './lectura-numerologia.component.html',
  styleUrl: './lectura-numerologia.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LecturaNumerologiaComponent
  implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  messages: ConversationMessage[] = [];
  currentMessage: string = '';
  messageInput = new FormControl('');
  isLoading: boolean = false;
  isTyping: boolean = false;
  hasStartedConversation: boolean = false;
  showDataForm: boolean = false;

  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // ✅ Configuración del servicio para MercadoPago
  numerologyServiceConfig: ServiceConfig = {
    serviceId: '4', // ID del servicio numerología en el backend
    serviceName: 'Lectura de Numerología',
    amount: 18000, // $18,000 COP (equivalente a ~4 EUR)
    description: 'Acceso completo a lecturas numerológicas ilimitadas',
  };

  // Variables para control de pagos (MercadoPago)
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForNumerology: boolean = false;

  // ✅ Contador de mensajes del usuario para lógica del 2do mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 4;

  // Propiedad para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  private backendUrl = environment.apiUrl;

  // Datos personales
  fullName: string = '';
  birthDate: string = '';

  // Números calculados
  personalNumbers = {
    lifePath: 0,
    destiny: 0,
  };

  // Info del numerólogo
  numerologistInfo = {
    name: 'Maestra Sofía',
    title: 'Guardiana de los Números Sagrados',
    specialty: 'Numerología y vibración numérica universal',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    'Bienvenido, buscador de la sabiduría numérica... Los números son el lenguaje del universo y revelan los secretos de tu destino. ¿Qué quieres saber sobre tu vibración numérica?',
    'Las energías numéricas me susurran que has venido a buscar respuestas... Soy la Maestra Sofía, guardiana de los números sagrados. ¿Qué secreto numérico te inquieta?',
    'Bienvenido al Templo de los Números Sagrados. Los patrones matemáticos del cosmos han anunciado tu llegada. Permíteme revelarte los secretos de tu código numérico.',
    'Los números danzan ante mí y revelan tu presencia... Cada número tiene un significado, cada cálculo revela un destino. ¿Qué números quieres que interprete para ti?',
  ];

  constructor(
    @Optional() public dialogRef: MatDialogRef<LecturaNumerologiaComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
    private numerologyService: NumerologiaService,
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
    console.log('🔢 ====== INICIANDO LECTURA DE NUMEROLOGÍA ======');

    // ✅ PASO 1: Verificar si ya está pagado
    this.hasUserPaidForNumerology =
      sessionStorage.getItem('hasUserPaidForNumerology_numerologie') ===
        'true' || this.mercadopagoService.isServicePaid('3');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForNumerology);

    // ✅ PASO 2: Verificar si viene de MercadoPago
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');
        console.log('  - Payment ID:', paymentStatus.paymentId);
        console.log('  - Service ID:', paymentStatus.serviceId);

        // Guardar estado de pago
        this.hasUserPaidForNumerology = true;
        sessionStorage.setItem('hasUserPaidForNumerology_numerologie', 'true');
        this.mercadopagoService.saveServicePaymentStatus('3', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('numerologyBlockedMessageId');

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
          role: 'numerologist',
          message: `✨ **¡Pago confirmado exitosamente!** ✨

🔢 Ahora tienes acceso completo e ilimitado a mis servicios de numerología sagrada.

Los números del universo se han alineado a tu favor. Puedes preguntarme lo que desees sobre tu camino de vida, números del destino, compatibilidades numéricas y todos los secretos que los números guardan para ti.

¿Qué misterio numérico quieres descubrir?`,
          timestamp: new Date(),
        };
        this.messages.push(successMessage);
        this.saveMessagesToSession();

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem(
          'pendingNumerologyMessage'
        );
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingNumerologyMessage');
          setTimeout(() => {
            this.processNumerologyUserMessage(pendingMessage);
          }, 2000);
        }

        this.cdr.markForCheck();
        return;
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        const pendingMessage: ConversationMessage = {
          role: 'numerologist',
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
      this.loadNumerologyData();
    }

    // ✅ PASO 5: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForNumerology && this.blockedMessageId) {
      console.log('🔓 Desbloqueando mensajes (usuario ya pagó)');
      this.blockedMessageId = null;
      sessionStorage.removeItem('numerologyBlockedMessageId');
    }

    // Probar conexión
    this.numerologyService.testConnection().subscribe({
      next: (response) => {
        console.log('✅ Conexión con servicio de numerología OK');
      },
      error: (error) => {
        console.error('❌ Error de conexión:', error);
      },
    });

    console.log('🔢 ====== INICIALIZACIÓN COMPLETADA ======');
    console.log('  - Usuario pagó:', this.hasUserPaidForNumerology);
    console.log('  - Mensajes:', this.messages.length);
    console.log('  - Contador mensajes usuario:', this.userMessageCount);

    this.cdr.markForCheck();
  }

  private loadNumerologyData(): void {
    const savedMessages = sessionStorage.getItem('numerologyMessages');
    const savedMessageCount = sessionStorage.getItem(
      'numerologyUserMessageCount'
    );
    const savedBlockedMessageId = sessionStorage.getItem(
      'numerologyBlockedMessageId'
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
    sessionStorage.setItem('numerologyUserMessageCount', '0');

    const randomWelcome =
      this.welcomeMessages[
        Math.floor(Math.random() * this.welcomeMessages.length)
      ];

    const welcomeMessage: ConversationMessage = {
      role: 'numerologist',
      message: randomWelcome,
      timestamp: new Date(),
    };

    this.messages.push(welcomeMessage);
    this.hasStartedConversation = true;
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
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    console.log('📤 Enviando mensaje...');
    console.log('  - Usuario pagó:', this.hasUserPaidForNumerology);
    console.log('  - Contador mensajes:', this.userMessageCount);

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForNumerology) {
      console.log('✅ Usuario tiene acceso completo, procesando mensaje...');
      this.shouldAutoScroll = true;
      this.processNumerologyUserMessage(userMessage);
      return;
    }

    // ✅ Verificar si es el 2do mensaje o posterior (requiere pago)
    if (this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT - 1) {
      console.log(`🔒 Mensaje #${this.userMessageCount + 1} - Requiere pago`);

      // Cerrar otros modales
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingNumerologyMessage', userMessage);

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
    this.processNumerologyUserMessage(userMessage);
  }

  private processNumerologyUserMessage(userMessage: string): void {
    // Incrementar contador de mensajes del usuario
    this.userMessageCount++;
    sessionStorage.setItem(
      'numerologyUserMessageCount',
      this.userMessageCount.toString()
    );

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    // Agregar mensaje del usuario
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isTyping = true;
    this.isLoading = true;

    // Preparar historial de conversación
    const conversationHistory = this.messages.slice(-10).map((msg) => ({
      role: msg.role === 'user' ? ('user' as const) : ('numerologist' as const),
      message: msg.message,
    }));

    // Enviar al servicio
    this.numerologyService
      .sendMessage(
        userMessage,
        this.birthDate || undefined,
        this.fullName || undefined,
        conversationHistory
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isTyping = false;
          this.shouldAutoScroll = true;

          if (response) {
            const messageId = Date.now().toString();

            const numerologistMsg: ConversationMessage = {
              role: 'numerologist',
              message: response,
              timestamp: new Date(),
              id: messageId,
            };
            this.messages.push(numerologistMsg);

            // ✅ Verificar si debe bloquear después del 2do mensaje
            if (
              !this.hasUserPaidForNumerology &&
              this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
            ) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('numerologyBlockedMessageId', messageId);

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
            this.handleError('Error al obtener respuesta del numerólogo');
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
      'numerologyUserMessageCount',
      this.userMessageCount.toString()
    );

    if (this.blockedMessageId) {
      sessionStorage.setItem(
        'numerologyBlockedMessageId',
        this.blockedMessageId
      );
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
      sessionStorage.setItem(
        'numerologyMessages',
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('numerologyMessages');
    sessionStorage.removeItem('numerologyUserMessageCount');
    sessionStorage.removeItem('numerologyBlockedMessageId');
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return (
      message.id === this.blockedMessageId && !this.hasUserPaidForNumerology
    );
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

  // ========== MÉTODOS DE FORMULARIO Y UI ==========

  savePersonalData(): void {
    if (this.fullName) {
      this.personalNumbers.destiny =
        this.numerologyService.calculateDestinyNumber(this.fullName);
    }

    if (this.birthDate) {
      this.personalNumbers.lifePath = this.numerologyService.calculateLifePath(
        this.birthDate
      );
    }

    this.showDataForm = false;

    if (this.personalNumbers.lifePath || this.personalNumbers.destiny) {
      let numbersMessage = 'He calculado tus números sagrados:\n\n';

      if (this.personalNumbers.lifePath) {
        numbersMessage += `🔹 Camino de Vida: ${
          this.personalNumbers.lifePath
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.lifePath
        )}\n\n`;
      }

      if (this.personalNumbers.destiny) {
        numbersMessage += `🔹 Número del Destino: ${
          this.personalNumbers.destiny
        } - ${this.numerologyService.getNumberMeaning(
          this.personalNumbers.destiny
        )}\n\n`;
      }

      numbersMessage +=
        '¿Quieres que profundice en la interpretación de alguno de estos números?';
      const numbersMsg: ConversationMessage = {
        role: 'numerologist',
        message: numbersMessage,
        timestamp: new Date(),
      };
      this.messages.push(numbersMsg);
      this.saveMessagesToSession();
    }
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  newConsultation(): void {
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    if (!this.hasUserPaidForNumerology) {
      this.userMessageCount = 0;
      this.blockedMessageId = null;
      this.clearSessionData();
    } else {
      sessionStorage.removeItem('numerologyMessages');
      sessionStorage.removeItem('numerologyUserMessageCount');
      sessionStorage.removeItem('numerologyBlockedMessageId');
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
      role: 'numerologist',
      message: `🔢 Los números cósmicos están en fluctuación... ${errorMessage} Intenta de nuevo cuando las vibraciones numéricas se hayan estabilizado.`,
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
      this.sendMessage();
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

  closeModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
}
