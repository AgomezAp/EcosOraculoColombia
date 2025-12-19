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
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ZodiacoChinoService } from '../../services/zodiaco-chino.service';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MercadopagoService } from '../../services/mercadopago.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environmets.prod';
import {
  RecolectaDatosComponent,
  ServiceConfig,
} from '../recolecta-datos/recolecta-datos.component';

interface ChatMessage {
  role: 'user' | 'master';
  message: string;
  timestamp?: string;
  id?: string;
}

interface MasterInfo {
  success: boolean;
  master: {
    name: string;
    title: string;
    specialty: string;
    description: string;
    services: string[];
  };
  timestamp: string;
}

interface ZodiacAnimal {
  animal?: string;
  symbol?: string;
  year?: number;
  element?: string;
  traits?: string[];
}

@Component({
  selector: 'app-zodiaco-chino',
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
  templateUrl: './zodiaco-chino.component.html',
  styleUrl: './zodiaco-chino.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZodiacoChinoComponent
  implements OnInit, AfterViewChecked, OnDestroy, AfterViewInit
{
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Propiedades principales
  masterInfo: MasterInfo | null = null;
  userForm: FormGroup;
  isFormCompleted = false;
  isLoading = false;
  currentMessage = '';
  conversationHistory: ChatMessage[] = [];
  zodiacAnimal: ZodiacAnimal = {};
  showDataForm = true;
  isTyping: boolean = false;

  // Control de scroll
  private shouldScrollToBottom = false;
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // Modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // ✅ Configuración del servicio para MercadoPago
  horoscopeServiceConfig: ServiceConfig = {
    serviceId: '8', // ID del servicio horóscopo/zodiaco chino en el backend
    serviceName: 'Horóscopo - Zodiaco Chino',
    amount: 18000, // $18,000 COP (equivalente a ~4 EUR)
    description: 'Acceso completo a lecturas astrológicas ilimitadas',
  };

  // Variables para control de pagos (MercadoPago)
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForHoroscope: boolean = false;

  // ✅ Contador de mensajes del usuario para lógica del 2do mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 4;

  // Propiedad para controlar mensajes bloqueados
  blockedMessageId: string | null = null;

  private backendUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private zodiacoChinoService: ZodiacoChinoService,
    private http: HttpClient,
    private elRef: ElementRef<HTMLElement>,
    private cdr: ChangeDetectorRef,
    private mercadopagoService: MercadopagoService
  ) {
    this.userForm = this.fb.group({
      fullName: [''],
      birthYear: [
        '',
        [Validators.required, Validators.min(1900), Validators.max(2024)],
      ],
      birthDate: [''],
      initialQuestion: [
        '¿Qué puedes decirme sobre mi signo zodiacal y horóscopo?',
      ],
    });
  }

  ngAfterViewInit(): void {
    this.setVideosSpeed(0.7);
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
    console.log('🔮 ====== INICIANDO HORÓSCOPO / ZODIACO CHINO ======');

    // ✅ PASO 1: Verificar si ya está pagado
    this.hasUserPaidForHoroscope =
      sessionStorage.getItem('hasUserPaidForHoroscope_horoskop') === 'true' ||
      this.mercadopagoService.isServicePaid('8');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForHoroscope);

    // ✅ PASO 2: Verificar si viene de MercadoPago
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');
        console.log('  - Payment ID:', paymentStatus.paymentId);
        console.log('  - Service ID:', paymentStatus.serviceId);

        // Guardar estado de pago
        this.hasUserPaidForHoroscope = true;
        sessionStorage.setItem('hasUserPaidForHoroscope_horoskop', 'true');
        this.mercadopagoService.saveServicePaymentStatus('8', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('horoscopeBlockedMessageId');

        // Recuperar datos guardados antes del pago
        const savedData = this.mercadopagoService.getPaymentData();
        if (savedData) {
          console.log('📦 Recuperando datos guardados:', savedData);

          // Recuperar mensajes del chat
          if (savedData.conversationHistory && savedData.conversationHistory.length > 0) {
            this.conversationHistory = savedData.conversationHistory.map((msg: any) => ({
              ...msg,
              timestamp: msg.timestamp,
            }));
            console.log('💬 Mensajes recuperados:', this.conversationHistory.length);
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

          // Recuperar datos del formulario
          if (savedData.formData) {
            this.userForm.patchValue(savedData.formData);
            this.isFormCompleted = true;
            this.showDataForm = false;
          }
        }

        // Limpiar datos de pago temporal
        this.mercadopagoService.clearPaymentData();

        // Limpiar parámetros de la URL
        this.mercadopagoService.cleanPaymentParamsFromUrl();

        // Agregar mensaje de confirmación de pago
        this.addMessage(
          'master',
          `✨ **¡Pago confirmado exitosamente!** ✨

🔮 Ahora tienes acceso completo e ilimitado a mis servicios de astrología y horóscopo.

Las estrellas y los signos del zodiaco se revelan ante ti. Puedes preguntarme lo que desees sobre tu signo, compatibilidad, predicciones y todos los secretos que el cosmos guarda para ti.

¿Qué aspecto de tu horóscopo quieres explorar?`
        );

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem('pendingHoroscopeMessage');
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingHoroscopeMessage');
          setTimeout(() => {
            this.processHoroscopeUserMessage(pendingMessage);
          }, 2000);
        }

        this.cdr.markForCheck();
        return;
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        this.addMessage(
          'master',
          '⏳ Tu pago está siendo procesado. Te notificaremos cuando se confirme.'
        );
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
    if (this.conversationHistory.length === 0) {
      this.loadHoroscopeData();
    }

    // ✅ PASO 5: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForHoroscope && this.blockedMessageId) {
      console.log('🔓 Desbloqueando mensajes (usuario ya pagó)');
      this.blockedMessageId = null;
      sessionStorage.removeItem('horoscopeBlockedMessageId');
    }

    // Cargar info del maestro
    this.loadMasterInfo();

    // Solo agregar mensaje de bienvenida si no hay mensajes guardados
    if (this.conversationHistory.length === 0) {
      this.initializeHoroscopeWelcomeMessage();
    }

    console.log('🔮 ====== INICIALIZACIÓN COMPLETADA ======');
    console.log('  - Usuario pagó:', this.hasUserPaidForHoroscope);
    console.log('  - Mensajes:', this.conversationHistory.length);
    console.log('  - Contador mensajes usuario:', this.userMessageCount);

    this.cdr.markForCheck();
  }

  private loadHoroscopeData(): void {
    const savedMessages = sessionStorage.getItem('horoscopeMessages');
    const savedMessageCount = sessionStorage.getItem('horoscopeUserMessageCount');
    const savedBlockedMessageId = sessionStorage.getItem('horoscopeBlockedMessageId');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.conversationHistory = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp,
        }));
        this.userMessageCount = parseInt(savedMessageCount || '0');
        this.blockedMessageId = savedBlockedMessageId || null;
        this.lastMessageCount = this.conversationHistory.length;
        console.log('💬 Mensajes cargados de sesión:', this.conversationHistory.length);
      } catch (error) {
        console.error('Error parseando mensajes:', error);
        this.clearHoroscopeSessionData();
        this.initializeHoroscopeWelcomeMessage();
      }
    }
  }

  private initializeHoroscopeWelcomeMessage(): void {
    this.userMessageCount = 0;
    sessionStorage.setItem('horoscopeUserMessageCount', '0');

    const welcomeMessage = `¡Bienvenido al Reino de las Estrellas! 🔮✨

Soy la Astróloga María, guía celestial de los signos del zodiaco. Durante décadas he estudiado las influencias de los planetas y constelaciones que guían nuestro destino.

Cada persona nace bajo la protección de un signo zodiacal que influye en su personalidad, su destino y su camino de vida. Para revelar los secretos de tu horóscopo y las influencias celestiales, necesito tu fecha de nacimiento.

Los doce signos (Aries, Tauro, Géminis, Cáncer, Leo, Virgo, Libra, Escorpio, Sagitario, Capricornio, Acuario y Piscis) tienen sabiduría ancestral que compartir.

¿Estás listo para descubrir lo que las estrellas revelan sobre tu destino? 🌙`;

    this.addMessage('master', welcomeMessage);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }

    if (
      this.shouldAutoScroll &&
      this.conversationHistory.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.conversationHistory.length;
    }
  }

  ngOnDestroy(): void {
    // Cleanup si es necesario
  }

  // ========== MÉTODOS DE GUARDADO Y SESIÓN ==========

  private saveHoroscopeMessagesToSession(): void {
    try {
      const messagesToSave = this.conversationHistory.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp,
      }));
      sessionStorage.setItem('horoscopeMessages', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  private clearHoroscopeSessionData(): void {
    sessionStorage.removeItem('horoscopeMessages');
    sessionStorage.removeItem('horoscopeUserMessageCount');
    sessionStorage.removeItem('horoscopeBlockedMessageId');
  }

  private saveHoroscopeStateBeforePayment(): void {
    console.log('💾 Guardando estado antes del pago...');

    this.saveHoroscopeMessagesToSession();

    sessionStorage.setItem('horoscopeUserMessageCount', this.userMessageCount.toString());

    if (this.blockedMessageId) {
      sessionStorage.setItem('horoscopeBlockedMessageId', this.blockedMessageId);
    }

    // Guardar datos para MercadoPago
    const paymentData = {
      conversationHistory: this.conversationHistory.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp,
      })),
      userMessageCount: this.userMessageCount,
      userData: this.userData,
      blockedMessageId: this.blockedMessageId,
      formData: this.userForm.value,
      timestamp: new Date().toISOString(),
    };

    this.mercadopagoService.savePaymentData(paymentData);
    console.log('✅ Estado guardado para recuperar después del pago');
  }

  isMessageBlocked(message: ChatMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForHoroscope;
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

  cancelHoroscopePayment(): void {
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
    this.paymentError = null;
    this.cdr.markForCheck();
  }

  // ========== MÉTODOS DEL CHAT ==========

  loadMasterInfo(): void {
    this.zodiacoChinoService.getMasterInfo().subscribe({
      next: (info) => {
        this.masterInfo = info;
      },
      error: (error) => {
        this.masterInfo = {
          success: true,
          master: {
            name: 'Astróloga María',
            title: 'Guía Celestial de los Signos',
            specialty: 'Astrología Occidental y Horóscopo Personalizado',
            description:
              'Astróloga sabia, especializada en la interpretación de influencias celestiales y la sabiduría de los doce signos del zodiaco',
            services: [
              'Interpretación de signos zodiacales',
              'Análisis de cartas astrales',
              'Predicciones de horóscopo',
              'Compatibilidad entre signos',
              'Consejos basados en astrología',
            ],
          },
          timestamp: new Date().toISOString(),
        };
      },
    });
  }

  startChatWithoutForm(): void {
    this.showDataForm = false;
  }

  startConsultation(): void {
    if (this.userForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.cdr.markForCheck();

      const formData = this.userForm.value;
      const initialMessage =
        formData.initialQuestion ||
        '¡Hola! Me gustaría saber más sobre mi signo zodiacal y horóscopo.';

      // Agregar mensaje del usuario
      this.addMessage('user', initialMessage);

      // Incrementar contador
      this.userMessageCount++;
      sessionStorage.setItem('horoscopeUserMessageCount', this.userMessageCount.toString());

      const consultationData = {
        zodiacData: {
          name: 'Astróloga María',
          specialty: 'Astrología Occidental y Horóscopo Personalizado',
          experience: 'Décadas de experiencia en interpretación astrológica',
        },
        userMessage: initialMessage,
        fullName: formData.fullName,
        birthYear: formData.birthYear?.toString(),
        birthDate: formData.birthDate,
        conversationHistory: this.conversationHistory,
      };

      this.zodiacoChinoService.chatWithMaster(consultationData).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success && response.response) {
            this.addMessage('master', response.response);
            this.isFormCompleted = true;
            this.showDataForm = false;
            this.saveHoroscopeMessagesToSession();
            this.cdr.markForCheck();
          } else {
            this.handleError('Error en la respuesta de la astróloga');
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleError(
            'Error al conectar con la astróloga: ' +
              (error.error?.error || error.message)
          );
          this.cdr.markForCheck();
        },
      });
    }
  }

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const message = this.currentMessage.trim();

    console.log('📤 Enviando mensaje...');
    console.log('  - Usuario pagó:', this.hasUserPaidForHoroscope);
    console.log('  - Contador mensajes:', this.userMessageCount);

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForHoroscope) {
      console.log('✅ Usuario tiene acceso completo, procesando mensaje...');
      this.processHoroscopeUserMessage(message);
      return;
    }

    // ✅ Verificar si es el 2do mensaje o posterior (requiere pago)
    if (this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT - 1) {
      console.log(`🔒 Mensaje #${this.userMessageCount + 1} - Requiere pago`);

      // Cerrar otros modales
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingHoroscopeMessage', message);

      // Guardar estado antes del pago
      this.saveHoroscopeStateBeforePayment();

      // Mostrar modal de datos
      setTimeout(() => {
        this.showDataModal = true;
        this.cdr.markForCheck();
      }, 100);

      return;
    }

    // Procesar mensaje normalmente (primer mensaje gratuito)
    this.processHoroscopeUserMessage(message);
  }

  private processHoroscopeUserMessage(message: string): void {
    // Incrementar contador de mensajes del usuario
    this.userMessageCount++;
    sessionStorage.setItem('horoscopeUserMessageCount', this.userMessageCount.toString());

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    this.currentMessage = '';
    this.isLoading = true;
    this.isTyping = true;
    this.cdr.markForCheck();

    // Agregar mensaje del usuario
    this.addMessage('user', message);

    const formData = this.userForm.value;
    const consultationData = {
      zodiacData: {
        name: 'Astróloga María',
        specialty: 'Astrología Occidental y Horóscopo Personalizado',
        experience: 'Décadas de experiencia en interpretación astrológica',
      },
      userMessage: message,
      fullName: formData.fullName,
      birthYear: formData.birthYear?.toString(),
      birthDate: formData.birthDate,
      conversationHistory: this.conversationHistory,
    };

    this.zodiacoChinoService.chatWithMaster(consultationData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.isTyping = false;
        this.cdr.markForCheck();

        if (response.success && response.response) {
          const messageId = Date.now().toString();

          this.addMessage('master', response.response, messageId);

          // ✅ Verificar si debe bloquear después del 2do mensaje
          if (
            !this.hasUserPaidForHoroscope &&
            this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
          ) {
            this.blockedMessageId = messageId;
            sessionStorage.setItem('horoscopeBlockedMessageId', messageId);

            // Mostrar modal de pago después de 2 segundos
            setTimeout(() => {
              this.saveHoroscopeStateBeforePayment();
              this.showPaymentModal = false;

              setTimeout(() => {
                this.showDataModal = true;
                this.cdr.markForCheck();
              }, 100);
            }, 2000);
          }

          this.saveHoroscopeMessagesToSession();
          this.cdr.markForCheck();
        } else {
          this.handleError('Error en la respuesta de la astróloga');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.isTyping = false;
        this.handleError(
          'Error al conectar con la astróloga: ' +
            (error.error?.error || error.message)
        );
        this.cdr.markForCheck();
      },
    });
  }

  // ========== MÉTODOS DE UTILIDAD ==========

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  resetConsultation(): void {
    this.conversationHistory = [];
    this.isFormCompleted = false;
    this.showDataForm = true;
    this.currentMessage = '';
    this.zodiacAnimal = {};
    this.userMessageCount = 0;
    this.blockedMessageId = null;

    if (!this.hasUserPaidForHoroscope) {
      this.clearHoroscopeSessionData();
    } else {
      sessionStorage.removeItem('horoscopeMessages');
      sessionStorage.removeItem('horoscopeUserMessageCount');
      sessionStorage.removeItem('horoscopeBlockedMessageId');
    }

    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        '¿Qué puedes decirme sobre mi signo zodiacal y horóscopo?',
    });
    this.initializeHoroscopeWelcomeMessage();
  }

  exploreCompatibility(): void {
    const message =
      '¿Podrías hablar sobre la compatibilidad de mi signo zodiacal con otros signos?';
    this.currentMessage = message;
    this.sendMessage();
  }

  exploreElements(): void {
    const message = '¿Cómo influyen los planetas en mi personalidad y destino?';
    this.currentMessage = message;
    this.sendMessage();
  }

  private addMessage(
    role: 'user' | 'master',
    message: string,
    id?: string
  ): void {
    const newMessage: ChatMessage = {
      role,
      message,
      timestamp: new Date().toISOString(),
      id: id || undefined,
    };
    this.conversationHistory.push(newMessage);
    this.shouldScrollToBottom = true;
    this.saveHoroscopeMessagesToSession();
    this.cdr.markForCheck();
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      try {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      } catch (err) {}
    }
  }

  private handleError(message: string): void {
    this.addMessage(
      'master',
      `Lo siento, ${message}. Por favor, intenta de nuevo.`
    );
  }

  formatMessage(content: string): string {
    if (!content) return '';

    let formattedContent = content;

    formattedContent = formattedContent.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    formattedContent = formattedContent.replace(/\n/g, '<br>');

    formattedContent = formattedContent.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    return formattedContent;
  }

  formatTime(timestamp?: string): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByMessage(index: number, message: ChatMessage): string {
    return `${message.role}-${message.timestamp}-${index}`;
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

  clearChat(): void {
    this.conversationHistory = [];
    this.currentMessage = '';
    this.userMessageCount = 0;
    this.blockedMessageId = null;
    this.isLoading = false;

    sessionStorage.removeItem('horoscopeMessages');
    sessionStorage.removeItem('horoscopeUserMessageCount');
    sessionStorage.removeItem('horoscopeBlockedMessageId');

    this.shouldScrollToBottom = true;
    this.initializeHoroscopeWelcomeMessage();
  }

  resetChat(): void {
    this.conversationHistory = [];
    this.currentMessage = '';

    this.isLoading = false;
    this.isTyping = false;

    this.isFormCompleted = false;
    this.showDataForm = true;

    this.userMessageCount = 0;
    this.blockedMessageId = null;

    this.showPaymentModal = false;
    this.showDataModal = false;

    this.shouldScrollToBottom = false;
    this.shouldAutoScroll = true;
    this.lastMessageCount = 0;

    this.zodiacAnimal = {};

    this.isProcessingPayment = false;
    this.paymentError = null;

    sessionStorage.removeItem('horoscopeMessages');
    sessionStorage.removeItem('horoscopeUserMessageCount');
    sessionStorage.removeItem('horoscopeBlockedMessageId');
    sessionStorage.removeItem('pendingHoroscopeMessage');

    this.userForm.reset({
      fullName: '',
      birthYear: '',
      birthDate: '',
      initialQuestion:
        '¿Qué puedes decirme sobre mi signo zodiacal y horóscopo?',
    });

    this.initializeHoroscopeWelcomeMessage();
    this.cdr.markForCheck();
  }
}