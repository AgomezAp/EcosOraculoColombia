import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
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
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  CalculadoraAmorService,
  CompatibilityData,
  ConversationMessage,
  LoveCalculatorResponse,
  LoveExpertInfo,
} from '../../services/calculadora-amor.service';
import { MercadopagoService } from '../../services/mercadopago.service';
import { Subject, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  RecolectaDatosComponent,
  ServiceConfig,
} from '../recolecta-datos/recolecta-datos.component';
import { environment } from '../../environments/environmets.prod';
import {
  FortuneWheelComponent,
  Prize,
} from '../fortune-wheel/fortune-wheel.component';

@Component({
  selector: 'app-calculadora-amor',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatNativeDateModule,
    RecolectaDatosComponent,
    FortuneWheelComponent,
  ],
  templateUrl: './calculadora-amor.component.html',
  styleUrl: './calculadora-amor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculadoraAmorComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Variables principales del chat
  conversationHistory: ConversationMessage[] = [];
  currentMessage: string = '';
  messageInput = new FormControl('');
  isLoading: boolean = false;
  isTyping: boolean = false;
  hasStartedConversation: boolean = false;
  showDataForm: boolean = false;

  // Modal de datos
  showDataModal: boolean = false;
  userData: any = null;

  // ✅ Configuración del servicio para MercadoPago
  loveServiceConfig: ServiceConfig = {
    serviceId: '9', // ID del servicio calculadora-amor en el backend
    serviceName: 'Calculadora del Amor',
    amount: 12000, // $12,000 COP
    description:
      'Acceso completo a consultas ilimitadas de compatibilidad amorosa',
  };

  // Control de scroll
  private shouldAutoScroll = true;
  private lastMessageCount = 0;

  // ✅ Variables para control de pagos (MercadoPago)
  showPaymentModal: boolean = false;
  isProcessingPayment: boolean = false;
  paymentError: string | null = null;
  hasUserPaidForLove: boolean = false;
  blockedMessageId: string | null = null;

  // ✅ Contador de mensajes del usuario para lógica del 3er mensaje
  userMessageCount: number = 0;
  private readonly MESSAGES_BEFORE_PAYMENT: number = 3;

  // Propiedades para la ruleta
  showFortuneWheel: boolean = false;
  lovePrizes: Prize[] = [
    {
      id: '1',
      name: '3 giros de la Rueda del Amor',
      color: '#ff69b4',
      icon: '💕',
    },
    {
      id: '2',
      name: '1 Análisis Premium de Compatibilidad',
      color: '#ff1493',
      icon: '💖',
    },
    {
      id: '4',
      name: '¡Intenta de nuevo!',
      color: '#dc143c',
      icon: '💘',
    },
  ];
  private wheelTimer: any;

  private backendUrl = environment.apiUrl;

  // Formulario reactivo
  compatibilityForm: FormGroup;

  // Estado del componente
  loveExpertInfo: LoveExpertInfo | null = null;
  compatibilityData: CompatibilityData | null = null;

  // Subject para manejar unsubscriptions
  private destroy$ = new Subject<void>();

  // Info del experto en amor
  loveExpertInfo_display = {
    name: 'Maestra Valentina',
    title: 'Guardiana del amor eterno',
    specialty: 'Numerología del amor y compatibilidad de almas',
  };

  // Frases de bienvenida aleatorias
  welcomeMessages = [
    '¡Bienvenido, alma enamorada! 💕 Soy la Maestra Paula, y estoy aquí para revelarte los secretos del verdadero amor. Las cartas del amor susurran historias de corazones unidos y pasiones eternas. ¿Estás listo para descubrir la compatibilidad de tu relación?',
    'Las energías del amor me susurran que has venido a buscar respuestas del corazón... Los números del amor revelan la química entre las almas. ¿Qué secreto romántico quieres conocer?',
    'Bienvenido al Templo del amor eterno. Los patrones numerológicos del romance han anunciado tu llegada. Permíteme calcular la compatibilidad de tu relación a través de la numerología sagrada.',
    'Los números del amor danzan ante mí y revelan tu presencia... Cada cálculo revela un destino romántico. ¿Qué pareja quieres que analice numerológicamente para ti?',
  ];

  // Altura del textarea
  textareaHeight: number = 45;
  private readonly minTextareaHeight = 45;
  private readonly maxTextareaHeight = 120;

  constructor(
    private calculadoraAmorService: CalculadoraAmorService,
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private mercadopagoService: MercadopagoService
  ) {
    this.compatibilityForm = this.createCompatibilityForm();
  }

  async ngOnInit(): Promise<void> {
    console.log('💕 ====== INICIANDO CALCULADORA DE AMOR ======');

    // ✅ PASO 1: Verificar si ya está pagado
    this.hasUserPaidForLove =
      sessionStorage.getItem('hasUserPaidForLove_liebesrechner') === 'true' ||
      this.mercadopagoService.isServicePaid('9');

    console.log('📊 Estado de pago inicial:', this.hasUserPaidForLove);

    // ✅ PASO 2: Verificar si viene de MercadoPago
    if (this.mercadopagoService.hasPaymentParams()) {
      console.log('🔄 Detectados parámetros de pago en URL');

      const paymentStatus = this.mercadopagoService.checkPaymentStatusFromUrl();

      if (paymentStatus.isPaid && paymentStatus.status === 'approved') {
        console.log('✅ ¡PAGO APROBADO!');
        console.log('  - Payment ID:', paymentStatus.paymentId);
        console.log('  - Service ID:', paymentStatus.serviceId);

        // Guardar estado de pago
        this.hasUserPaidForLove = true;
        sessionStorage.setItem('hasUserPaidForLove_liebesrechner', 'true');
        this.mercadopagoService.saveServicePaymentStatus('9', true);

        // Desbloquear mensajes
        this.blockedMessageId = null;
        sessionStorage.removeItem('loveBlockedMessageId');

        // Recuperar datos guardados antes del pago
        const savedData = this.mercadopagoService.getPaymentData();
        if (savedData) {
          console.log('📦 Recuperando datos guardados:', savedData);

          // Recuperar mensajes del chat
          if (
            savedData.conversationHistory &&
            savedData.conversationHistory.length > 0
          ) {
            this.conversationHistory = savedData.conversationHistory.map(
              (msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
              })
            );
            this.hasStartedConversation = true;
            console.log(
              '💬 Mensajes recuperados:',
              this.conversationHistory.length
            );
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
          role: 'love_expert',
          message: `✨ **¡Pago confirmado exitosamente!** ✨

💕 Ahora tienes acceso completo e ilimitado a mis servicios de compatibilidad amorosa.

Las energías del amor fluyen libremente hacia ti. Puedes preguntarme lo que desees sobre tu compatibilidad, relaciones y el destino romántico que te aguarda.

¿Qué secreto del amor quieres descubrir?`,
          timestamp: new Date(),
        };
        this.conversationHistory.push(successMessage);
        this.saveMessagesToSession();

        // Procesar mensaje pendiente si existe
        const pendingMessage = sessionStorage.getItem('pendingLoveMessage');
        if (pendingMessage) {
          console.log('📨 Procesando mensaje pendiente:', pendingMessage);
          sessionStorage.removeItem('pendingLoveMessage');
          setTimeout(() => {
            this.processLoveUserMessage(pendingMessage);
          }, 2000);
        }

        this.cdr.markForCheck();
        return;
      } else if (paymentStatus.status === 'pending') {
        console.log('⏳ Pago pendiente');
        const pendingMessage: ConversationMessage = {
          role: 'love_expert',
          message:
            '⏳ Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          timestamp: new Date(),
        };
        this.conversationHistory.push(pendingMessage);
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
    if (this.conversationHistory.length === 0) {
      this.loadLoveData();
    }

    // ✅ PASO 5: Si ya pagó, desbloquear todo
    if (this.hasUserPaidForLove && this.blockedMessageId) {
      console.log('🔓 Desbloqueando mensajes (usuario ya pagó)');
      this.blockedMessageId = null;
      sessionStorage.removeItem('loveBlockedMessageId');
    }

    // Cargar info del experto
    this.loadLoveExpertInfo();
    this.subscribeToCompatibilityData();

    // Mostrar ruleta si aplica
    if (
      this.conversationHistory.length > 0 &&
      FortuneWheelComponent.canShowWheel()
    ) {
      this.showLoveWheelAfterDelay(2000);
    }

    console.log('💕 ====== INICIALIZACIÓN COMPLETADA ======');
    console.log('  - Usuario pagó:', this.hasUserPaidForLove);
    console.log('  - Mensajes:', this.conversationHistory.length);
    console.log('  - Contador mensajes usuario:', this.userMessageCount);

    this.cdr.markForCheck();
  }

  private loadLoveData(): void {
    const savedMessages = sessionStorage.getItem('loveMessages');
    const savedMessageCount = sessionStorage.getItem('loveUserMessageCount');
    const savedBlockedMessageId = sessionStorage.getItem(
      'loveBlockedMessageId'
    );

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        this.conversationHistory = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        this.userMessageCount = parseInt(savedMessageCount || '0');
        this.blockedMessageId = savedBlockedMessageId || null;
        this.hasStartedConversation = true;
        this.lastMessageCount = this.conversationHistory.length;
        console.log(
          '💬 Mensajes cargados de sesión:',
          this.conversationHistory.length
        );
      } catch (error) {
        console.error('Error parseando mensajes:', error);
        this.clearSessionData();
        this.initializeLoveWelcomeMessage();
      }
    } else {
      this.initializeLoveWelcomeMessage();
    }
  }

  private initializeLoveWelcomeMessage(): void {
    this.userMessageCount = 0;
    sessionStorage.setItem('loveUserMessageCount', '0');

    const randomWelcome =
      this.welcomeMessages[
        Math.floor(Math.random() * this.welcomeMessages.length)
      ];

    const welcomeMessage: ConversationMessage = {
      role: 'love_expert',
      message: randomWelcome,
      timestamp: new Date(),
    };

    this.conversationHistory.push(welcomeMessage);
    this.hasStartedConversation = true;

    if (FortuneWheelComponent.canShowWheel()) {
      this.showLoveWheelAfterDelay(3000);
    }
  }

  ngAfterViewChecked(): void {
    if (
      this.shouldAutoScroll &&
      this.conversationHistory.length > this.lastMessageCount
    ) {
      this.scrollToBottom();
      this.lastMessageCount = this.conversationHistory.length;
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
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== MÉTODOS DE ENVÍO DE MENSAJES ==========

  sendMessage(): void {
    if (!this.currentMessage.trim() || this.isLoading) return;

    const userMessage = this.currentMessage.trim();

    console.log('📤 Enviando mensaje...');
    console.log('  - Usuario pagó:', this.hasUserPaidForLove);
    console.log('  - Contador mensajes:', this.userMessageCount);

    // ✅ Si ya pagó, procesar mensaje directamente
    if (this.hasUserPaidForLove) {
      console.log('✅ Usuario tiene acceso completo, procesando mensaje...');
      this.shouldAutoScroll = true;
      this.processLoveUserMessage(userMessage);
      return;
    }

    // ✅ Verificar consultas gratis
    if (this.hasFreeLoveConsultationsAvailable()) {
      console.log('🎁 Usando consulta gratuita');
      this.useFreeLoveConsultation();
      this.shouldAutoScroll = true;
      this.processLoveUserMessage(userMessage);
      return;
    }

    // ✅ Verificar si es el 3er mensaje o posterior
    if (this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT - 1) {
      console.log(`🔒 Mensaje #${this.userMessageCount + 1} - Requiere pago`);

      // Cerrar otros modales
      this.showFortuneWheel = false;
      this.showPaymentModal = false;

      // Guardar mensaje pendiente
      sessionStorage.setItem('pendingLoveMessage', userMessage);

      // Guardar estado antes del pago
      this.saveStateBeforePayment();

      // Mostrar modal de datos
      setTimeout(() => {
        this.showDataModal = true;
        this.cdr.markForCheck();
      }, 100);

      return;
    }

    // Procesar mensaje normalmente (mensajes 1 y 2)
    this.shouldAutoScroll = true;
    this.processLoveUserMessage(userMessage);
  }

  private processLoveUserMessage(userMessage: string): void {
    // Incrementar contador de mensajes del usuario
    this.userMessageCount++;
    sessionStorage.setItem(
      'loveUserMessageCount',
      this.userMessageCount.toString()
    );

    console.log(`📨 Mensaje del usuario #${this.userMessageCount}`);

    // Agregar mensaje del usuario
    const userMsg: ConversationMessage = {
      role: 'user',
      message: userMessage,
      timestamp: new Date(),
    };
    this.conversationHistory.push(userMsg);

    this.saveMessagesToSession();
    this.currentMessage = '';
    this.isTyping = true;
    this.isLoading = true;

    const compatibilityData =
      this.calculadoraAmorService.getCompatibilityData();

    // Enviar al servicio
    this.calculadoraAmorService
      .chatWithLoveExpert(
        userMessage,
        compatibilityData?.person1Name,
        compatibilityData?.person1BirthDate,
        compatibilityData?.person2Name,
        compatibilityData?.person2BirthDate
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isTyping = false;
          this.shouldAutoScroll = true;

          if (response.success && response.response) {
            const messageId = Date.now().toString();

            const loveExpertMsg: ConversationMessage = {
              role: 'love_expert',
              message: response.response,
              timestamp: new Date(),
              id: messageId,
            };
            this.conversationHistory.push(loveExpertMsg);

            // ✅ Verificar si debe bloquear después del 3er mensaje
            if (
              !this.hasUserPaidForLove &&
              !this.hasFreeLoveConsultationsAvailable() &&
              this.userMessageCount >= this.MESSAGES_BEFORE_PAYMENT
            ) {
              this.blockedMessageId = messageId;
              sessionStorage.setItem('loveBlockedMessageId', messageId);

              // Mostrar modal de pago después de 2 segundos
              setTimeout(() => {
                this.saveStateBeforePayment();
                this.showFortuneWheel = false;
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
            this.handleError(
              'Error al obtener la respuesta del experto en amor'
            );
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
      'loveUserMessageCount',
      this.userMessageCount.toString()
    );

    if (this.blockedMessageId) {
      sessionStorage.setItem('loveBlockedMessageId', this.blockedMessageId);
    }

    // Guardar datos para MercadoPago
    const paymentData = {
      conversationHistory: this.conversationHistory.map((msg) => ({
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
      const messagesToSave = this.conversationHistory.map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));
      sessionStorage.setItem('loveMessages', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  private clearSessionData(): void {
    sessionStorage.removeItem('loveMessages');
    sessionStorage.removeItem('loveUserMessageCount');
    sessionStorage.removeItem('loveBlockedMessageId');
  }

  isMessageBlocked(message: ConversationMessage): boolean {
    return message.id === this.blockedMessageId && !this.hasUserPaidForLove;
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

  // ========== MÉTODOS DE LA RULETA ==========

  showLoveWheelAfterDelay(delayMs: number = 3000): void {
    if (this.wheelTimer) {
      clearTimeout(this.wheelTimer);
    }

    this.wheelTimer = setTimeout(() => {
      if (
        FortuneWheelComponent.canShowWheel() &&
        !this.showPaymentModal &&
        !this.showDataModal
      ) {
        this.showFortuneWheel = true;
        this.cdr.markForCheck();
      }
    }, delayMs);
  }

  onPrizeWon(prize: Prize): void {
    const prizeMessage: ConversationMessage = {
      role: 'love_expert',
      message: `💕 ¡El verdadero amor ha conspirado a tu favor! Has ganado: **${prize.name}** ${prize.icon}\n\nLas fuerzas románticas del universo han decidido bendecirte con este regalo celestial.`,
      timestamp: new Date(),
    };

    this.conversationHistory.push(prizeMessage);
    this.shouldAutoScroll = true;
    this.saveMessagesToSession();
    this.processLovePrize(prize);
  }

  onWheelClosed(): void {
    this.showFortuneWheel = false;
  }

  triggerLoveWheel(): void {
    if (this.showPaymentModal || this.showDataModal) {
      return;
    }

    if (FortuneWheelComponent.canShowWheel()) {
      this.showFortuneWheel = true;
      this.cdr.markForCheck();
    } else {
      alert(
        'No tienes giros disponibles. ' + FortuneWheelComponent.getSpinStatus()
      );
    }
  }

  getSpinStatus(): string {
    return FortuneWheelComponent.getSpinStatus();
  }

  private processLovePrize(prize: Prize): void {
    switch (prize.id) {
      case '1':
        this.addFreeLoveConsultations(3);
        break;
      case '2':
        this.hasUserPaidForLove = true;
        sessionStorage.setItem('hasUserPaidForLove_liebesrechner', 'true');
        this.mercadopagoService.saveServicePaymentStatus('9', true);

        if (this.blockedMessageId) {
          this.blockedMessageId = null;
          sessionStorage.removeItem('loveBlockedMessageId');
        }

        const premiumMessage: ConversationMessage = {
          role: 'love_expert',
          message:
            '💖 **¡Has desbloqueado el acceso Premium completo!** 💖\n\nAhora tienes acceso ilimitado a todos mis servicios de compatibilidad amorosa.',
          timestamp: new Date(),
        };
        this.conversationHistory.push(premiumMessage);
        this.shouldAutoScroll = true;
        this.saveMessagesToSession();
        break;
      case '4':
        break;
      default:
    }
  }

  private addFreeLoveConsultations(count: number): void {
    const current = parseInt(
      sessionStorage.getItem('freeLoveConsultations') || '0'
    );
    const newTotal = current + count;
    sessionStorage.setItem('freeLoveConsultations', newTotal.toString());

    if (this.blockedMessageId && !this.hasUserPaidForLove) {
      this.blockedMessageId = null;
      sessionStorage.removeItem('loveBlockedMessageId');
    }
  }

  private hasFreeLoveConsultationsAvailable(): boolean {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeLoveConsultations') || '0'
    );
    return freeConsultations > 0;
  }

  private useFreeLoveConsultation(): void {
    const freeConsultations = parseInt(
      sessionStorage.getItem('freeLoveConsultations') || '0'
    );

    if (freeConsultations > 0) {
      const remaining = freeConsultations - 1;
      sessionStorage.setItem('freeLoveConsultations', remaining.toString());

      const prizeMsg: ConversationMessage = {
        role: 'love_expert',
        message: `✨ *Has utilizado una consulta de amor gratuita* ✨\n\nTe quedan **${remaining}** consultas gratuitas disponibles.`,
        timestamp: new Date(),
      };
      this.conversationHistory.push(prizeMsg);
      this.shouldAutoScroll = true;
      this.saveMessagesToSession();
    }
  }

  // ========== MÉTODOS DE FORMULARIO Y UI ==========

  private createCompatibilityForm(): FormGroup {
    return this.formBuilder.group({
      person1Name: ['', [Validators.required, Validators.minLength(2)]],
      person1BirthDate: ['', Validators.required],
      person2Name: ['', [Validators.required, Validators.minLength(2)]],
      person2BirthDate: ['', Validators.required],
    });
  }

  private loadLoveExpertInfo(): void {
    this.calculadoraAmorService
      .getLoveExpertInfo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (info) => {
          this.loveExpertInfo = info;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error cargando info del experto:', error);
          this.cdr.markForCheck();
        },
      });
  }

  private subscribeToCompatibilityData(): void {
    this.calculadoraAmorService.compatibilityData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.compatibilityData = data;
        if (data) {
          this.populateFormWithData(data);
        }
      });
  }

  private populateFormWithData(data: CompatibilityData): void {
    this.compatibilityForm.patchValue({
      person1Name: data.person1Name,
      person1BirthDate: new Date(data.person1BirthDate),
      person2Name: data.person2Name,
      person2BirthDate: new Date(data.person2BirthDate),
    });
  }

  calculateCompatibility(): void {
    if (this.compatibilityForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formValues = this.compatibilityForm.value;
    const compatibilityData: CompatibilityData = {
      person1Name: formValues.person1Name.trim(),
      person1BirthDate: this.formatDateForService(formValues.person1BirthDate),
      person2Name: formValues.person2Name.trim(),
      person2BirthDate: this.formatDateForService(formValues.person2BirthDate),
    };

    this.isLoading = true;
    this.calculadoraAmorService
      .calculateCompatibility(compatibilityData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.handleCalculationResponse(response);
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.handleError(error);
          this.cdr.markForCheck();
        },
        complete: () => {
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private handleCalculationResponse(response: LoveCalculatorResponse): void {
    if (response.success) {
      this.hasStartedConversation = true;
      this.showDataForm = false;

      const calculationMsg: ConversationMessage = {
        role: 'love_expert',
        message: `✨ He completado el análisis numerológico de ${this.compatibilityForm.value.person1Name} y ${this.compatibilityForm.value.person2Name}. Los números del amor han revelado información fascinante sobre vuestra compatibilidad. ¿Quieres conocer los detalles de esta lectura de amor?`,
        timestamp: new Date(),
      };

      this.conversationHistory.push(calculationMsg);
      this.saveMessagesToSession();
      this.shouldAutoScroll = true;
    }
  }

  startConversation(): void {
    if (this.conversationHistory.length === 0) {
      this.initializeLoveWelcomeMessage();
    }
    this.hasStartedConversation = true;
  }

  autoResize(event: any): void {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

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

  onEnterPressed(event: KeyboardEvent): void {
    if (event.shiftKey) {
      return;
    }
    event.preventDefault();
    if (this.canSendMessage() && !this.isLoading) {
      this.sendMessage();
      setTimeout(() => {
        this.textareaHeight = this.minTextareaHeight;
      }, 50);
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  canSendMessage(): boolean {
    return !!(this.currentMessage && this.currentMessage.trim().length > 0);
  }

  clearConversation(): void {
    this.conversationHistory = [];
    this.currentMessage = '';
    this.lastMessageCount = 0;
    this.userMessageCount = 0;
    this.blockedMessageId = null;
    this.isLoading = false;
    this.hasStartedConversation = false;

    this.clearSessionData();
    this.calculadoraAmorService.resetService();
    this.compatibilityForm.reset();

    this.shouldAutoScroll = true;
    this.initializeLoveWelcomeMessage();
    this.cdr.markForCheck();
  }

  newConsultation(): void {
    this.clearConversation();
  }

  resetChat(): void {
    this.clearConversation();
  }

  savePersonalData(): void {
    this.showDataForm = false;
  }

  toggleDataForm(): void {
    this.showDataForm = !this.showDataForm;
  }

  trackByMessage(index: number, message: ConversationMessage): string {
    return `${message.role}-${message.timestamp.getTime()}-${index}`;
  }

  formatTime(timestamp: Date | string): string {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  }

  getTimeString(timestamp: Date | string): string {
    return this.formatTime(timestamp);
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

  private handleError(errorMessage: string): void {
    const errorMsg: ConversationMessage = {
      role: 'love_expert',
      message: `💕 Las energías del amor fluctúan... ${errorMessage} Intenta de nuevo cuando las vibraciones románticas se estabilicen.`,
      timestamp: new Date(),
    };
    this.conversationHistory.push(errorMsg);
    this.shouldAutoScroll = true;
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch {}
  }

  private formatDateForService(date: Date): string {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.compatibilityForm.controls).forEach((key) => {
      const control = this.compatibilityForm.get(key);
      control?.markAsTouched();
    });
  }

  hasFormError(fieldName: string, errorType: string): boolean {
    const field = this.compatibilityForm.get(fieldName);
    return !!(
      field &&
      field.hasError(errorType) &&
      (field.dirty || field.touched)
    );
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.compatibilityForm.get(fieldName);
    if (field?.hasError('required')) return 'Este campo es requerido';
    if (field?.hasError('minlength')) return 'Mínimo 2 caracteres';
    return '';
  }
}
