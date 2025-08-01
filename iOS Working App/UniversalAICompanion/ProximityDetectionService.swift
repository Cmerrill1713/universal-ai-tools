import Foundation
import CoreBluetooth
import CoreLocation

protocol ProximityDetectionDelegate: AnyObject {
    func proximityDidUpdate(_ proximity: ProximityState, rssi: Int)
    func proximityDetectionDidFail(error: ProximityError)
}

@MainActor
class ProximityDetectionService: NSObject, ObservableObject {
    
    // MARK: - Published Properties
    @Published var currentProximity: ProximityState = .unknown
    @Published var rssiValue: Int = -100
    @Published var isScanning: Bool = false
    @Published var bluetoothState: CBManagerState = .unknown
    
    // MARK: - Private Properties
    private var centralManager: CBCentralManager?
    private var peripheralManager: CBPeripheralManager?
    private var beaconRegion: CLBeaconRegion?
    private var locationManager: CLLocationManager?
    
    // Delegate
    weak var delegate: ProximityDetectionDelegate?
    
    // Constants
    private let serviceUUID = CBUUID(string: "12345678-1234-1234-1234-123456789ABC")
    private let characteristicUUID = CBUUID(string: "87654321-4321-4321-4321-CBA987654321")
    private let beaconUUID = UUID(uuidString: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0")!
    private let beaconIdentifier = "UniversalAITools.Beacon"
    
    // Timer for periodic proximity updates
    private var proximityTimer: Timer?
    
    // RSSI tracking for smoothing
    private var lastRSSIValues: [String: [Int]] = [:]
    private var lastProximityChange: Date = Date()
    private var consecutiveUnchangedScans: Int = 0
    private var scanTimer: Timer?
    
    // Constants for scanning behavior
    private struct Constants {
        static let scanInterval: TimeInterval = 2.0
        static let maxRSSIHistory: Int = 5
    }
    
    // MARK: - Initialization
    override init() {
        super.init()
        setupBluetoothCentral()
        setupBeaconRegion()
    }
    
    deinit {
        Task { @MainActor in
            stopProximityDetection()
        }
    }
    
    // MARK: - Public Methods
    
    func startProximityDetection() {
        guard checkBluetoothPermissions() else { return }
        guard bluetoothState == .poweredOn else {
            delegate?.proximityDetectionDidFail(error: .bluetoothUnavailable)
            return
        }
        
        isScanning = true
        
        // Start BLE scanning
        startBLEScanning()
        
        // Start beacon monitoring
        startBeaconMonitoring()
        
        // Start periodic proximity updates
        startProximityTimer()
        
        print("🔵 Started proximity detection")
    }
    
    func stopProximityDetection() {
        isScanning = false
        
        // Stop BLE scanning
        centralManager?.stopScan()
        
        // Stop beacon monitoring
        stopBeaconMonitoring()
        
        // Stop timer
        proximityTimer?.invalidate()
        proximityTimer = nil
        
        print("🔴 Stopped proximity detection")
    }
    
    @MainActor
    func updateProximityMainThread(to newState: ProximityState, rssi: Int) {
        self.currentProximity = newState
        self.rssiValue = rssi
        self.delegate?.proximityDidUpdate(newState, rssi: rssi)
    }
    
    func updateProximitySafely(to newState: ProximityState, rssi: Int) {
        Task { @MainActor in
            await updateProximityMainThread(to: newState, rssi: rssi)
        }
    }
    
    func updateProximity(to newState: ProximityState, rssi: Int) {
        updateProximitySafely(to: newState, rssi: rssi)
    }
    
    // MARK: - Private Methods - Bluetooth Setup
    
    private func setupBluetoothCentral() {
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }
    
    private func setupBeaconRegion() {
        locationManager = CLLocationManager()
        locationManager?.delegate = self
        locationManager?.requestWhenInUseAuthorization()
        
        beaconRegion = CLBeaconRegion(
            uuid: beaconUUID,
            identifier: beaconIdentifier
        )
        beaconRegion?.notifyOnEntry = true
        beaconRegion?.notifyOnExit = true
        beaconRegion?.notifyEntryStateOnDisplay = true
    }
    
    // MARK: - Private Methods - BLE Scanning
    
    private func startBLEScanning() {
        guard let centralManager = centralManager, centralManager.state == .poweredOn else {
            return
        }
        
        let options: [String: Any] = [
            CBCentralManagerScanOptionAllowDuplicatesKey: true
        ]
        
        centralManager.scanForPeripherals(withServices: [serviceUUID], options: options)
        print("🔍 Started BLE scanning for Universal AI Tools devices")
    }
    
    // MARK: - Private Methods - Beacon Monitoring
    
    private func startBeaconMonitoring() {
        guard let locationManager = locationManager,
              let beaconRegion = beaconRegion else {
            return
        }
        
        if CLLocationManager.isMonitoringAvailable(for: CLBeaconRegion.self) {
            locationManager.startMonitoring(for: beaconRegion)
            locationManager.requestState(for: beaconRegion)
            print("📡 Started beacon monitoring")
        }
    }
    
    private func stopBeaconMonitoring() {
        guard let locationManager = locationManager,
              let beaconRegion = beaconRegion else {
            return
        }
        
        locationManager.stopMonitoring(for: beaconRegion)
        locationManager.stopRangingBeacons(satisfying: beaconRegion.beaconIdentityConstraint)
    }
    
    // MARK: - Private Methods - Proximity Timer
    
    private func startProximityTimer() {
        proximityTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.sendProximityUpdate()
        }
    }
    
    private func sendProximityUpdate() {
        // Send current proximity state to backend
        Task {
            await sendProximityToBackend()
        }
    }
    
    private func sendProximityToBackend() async {
        guard currentProximity != .unknown else { return }
        
        // This would integrate with DeviceAuthenticationManager
        // For now, just log the proximity
        print("📍 Proximity: \(currentProximity.rawValue), RSSI: \(rssiValue)")
    }
    
    // MARK: - Private Methods - Proximity Calculation
    
    private func calculateProximity(from rssi: Int) -> ProximityState {
        switch rssi {
        case -50...0:
            return .immediate
        case -70..<(-50):
            return .near
        case -90..<(-70):
            return .far
        default:
            return .unknown
        }
    }
    
    private func processPeripheral(_ peripheral: CBPeripheral, rssi: NSNumber) {
        let rssiValue = rssi.intValue
        let deviceId = peripheral.identifier.uuidString
        
        // Store RSSI history for smoothing
        if lastRSSIValues[deviceId] == nil {
            lastRSSIValues[deviceId] = []
        }
        lastRSSIValues[deviceId]?.append(rssiValue)
        
        // Keep only recent values
        if let values = lastRSSIValues[deviceId], values.count > 5 {
            lastRSSIValues[deviceId] = Array(values.suffix(5))
        }
        
        // Calculate average RSSI from history
        let avgRSSI: Int
        if let values = lastRSSIValues[deviceId], !values.isEmpty {
            avgRSSI = values.reduce(0, +) / values.count
        } else {
            avgRSSI = rssiValue
        }
        
        let proximity = calculateProximity(from: avgRSSI)
        
        // Only update if proximity changed or significant RSSI change
        if proximity != currentProximity || abs(avgRSSI - rssiValue) > 10 {
            updateProximitySafely(to: proximity, rssi: avgRSSI)
            lastProximityChange = Date()
            consecutiveUnchangedScans = 0
        } else {
            consecutiveUnchangedScans += 1
            
            // Reduce scan frequency if proximity is stable
            if consecutiveUnchangedScans > 5 && scanTimer?.timeInterval != Constants.scanInterval * 2 {
                adjustScanFrequency(increase: true)
            }
        }
        
        print("📱 Device: \(peripheral.name ?? "Unknown") - RSSI: \(rssiValue) (avg: \(avgRSSI)) - Proximity: \(proximity.rawValue)")
    }
    
    private func adjustScanFrequency(increase: Bool) {
        scanTimer?.invalidate()
        
        let newInterval = increase ? Constants.scanInterval * 2 : Constants.scanInterval
        scanTimer = Timer.scheduledTimer(withTimeInterval: newInterval, repeats: true) { [weak self] _ in
            self?.startBLEScanning()
        }
        
        print("⚡ Adjusted scan frequency to \(newInterval)s for battery optimization")
    }
}

// MARK: - CBCentralManagerDelegate

extension ProximityDetectionService: @preconcurrency CBCentralManagerDelegate {
    
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        DispatchQueue.main.async {
            self.bluetoothState = central.state
        }
        
        switch central.state {
        case .poweredOn:
            print("✅ Bluetooth is powered on")
            if isScanning {
                startBLEScanning()
            }
        case .poweredOff:
            print("❌ Bluetooth is powered off")
            delegate?.proximityDetectionDidFail(error: .bluetoothUnavailable)
        case .unauthorized:
            print("❌ Bluetooth access unauthorized")
            delegate?.proximityDetectionDidFail(error: .bluetoothUnauthorized)
        case .unsupported:
            print("❌ Bluetooth unsupported on this device")
            delegate?.proximityDetectionDidFail(error: .bluetoothUnsupported)
        default:
            print("🔄 Bluetooth state: \(central.state.rawValue)")
        }
    }
    
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        
        // Filter for Universal AI Tools devices
        if let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String,
           localName.contains("UniversalAITools") || localName.contains("UAT") {
            processPeripheral(peripheral, rssi: RSSI)
        }
        
        // Also check for service UUIDs
        if let serviceUUIDs = advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID],
           serviceUUIDs.contains(serviceUUID) {
            processPeripheral(peripheral, rssi: RSSI)
        }
    }
    
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        print("✅ Connected to peripheral: \(peripheral.name ?? "Unknown")")
        peripheral.delegate = self
        peripheral.discoverServices([serviceUUID])
    }
    
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        print("❌ Disconnected from peripheral: \(peripheral.name ?? "Unknown")")
        if let error = error {
            print("Disconnection error: \(error.localizedDescription)")
        }
        
        // Update proximity to unknown when disconnected
        updateProximitySafely(to: .unknown, rssi: -100)
    }
}

// MARK: - CBPeripheralDelegate

extension ProximityDetectionService: @preconcurrency CBPeripheralDelegate {
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard error == nil else {
            print("❌ Error discovering services: \(error!.localizedDescription)")
            return
        }
        
        guard let services = peripheral.services else { return }
        
        for service in services {
            if service.uuid == serviceUUID {
                peripheral.discoverCharacteristics([characteristicUUID], for: service)
            }
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard error == nil else {
            print("❌ Error discovering characteristics: \(error!.localizedDescription)")
            return
        }
        
        guard let characteristics = service.characteristics else { return }
        
        for characteristic in characteristics {
            if characteristic.uuid == characteristicUUID {
                // Subscribe to notifications for proximity updates
                peripheral.setNotifyValue(true, for: characteristic)
            }
        }
    }
    
    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil else {
            print("❌ Error updating characteristic value: \(error!.localizedDescription)")
            return
        }
        
        guard let data = characteristic.value else { return }
        
        // Parse proximity data from characteristic
        // This would contain custom proximity information from the backend device
        if let proximityString = String(data: data, encoding: .utf8) {
            print("📡 Received proximity data: \(proximityString)")
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension ProximityDetectionService: @preconcurrency CLLocationManagerDelegate {
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            print("✅ Location authorization granted")
            if isScanning {
                startBeaconMonitoring()
            }
        case .denied, .restricted:
            print("❌ Location authorization denied")
            delegate?.proximityDetectionDidFail(error: .locationUnauthorized)
        default:
            break
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        if region.identifier == beaconIdentifier {
            print("📍 Entered Universal AI Tools beacon region")
            
            // Start ranging beacons for precise proximity
            if let beaconRegion = region as? CLBeaconRegion {
                manager.startRangingBeacons(satisfying: beaconRegion.beaconIdentityConstraint)
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        if region.identifier == beaconIdentifier {
            print("📍 Exited Universal AI Tools beacon region")
            updateProximitySafely(to: .unknown, rssi: -100)
            
            // Stop ranging beacons
            if let beaconRegion = region as? CLBeaconRegion {
                manager.stopRangingBeacons(satisfying: beaconRegion.beaconIdentityConstraint)
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didRange beacons: [CLBeacon], satisfying beaconConstraint: CLBeaconIdentityConstraint) {
        
        guard let closestBeacon = beacons.first else {
            updateProximitySafely(to: .unknown, rssi: -100)
            return
        }
        
        let rssi = Int(closestBeacon.rssi)
        let proximity: ProximityState
        
        switch closestBeacon.proximity {
        case .immediate:
            proximity = .immediate
        case .near:
            proximity = .near
        case .far:
            proximity = .far
        default:
            proximity = .unknown
        }
        
        updateProximitySafely(to: proximity, rssi: rssi)
        print("📡 Beacon proximity: \(proximity.rawValue), RSSI: \(rssi)")
    }
}

// MARK: - Supporting Types

enum ProximityError: Error, LocalizedError {
    case bluetoothUnavailable
    case bluetoothUnauthorized
    case bluetoothUnsupported
    case locationUnauthorized
    case scanningFailed
    
    var errorDescription: String? {
        switch self {
        case .bluetoothUnavailable:
            return "Bluetooth is not available or powered off"
        case .bluetoothUnauthorized:
            return "Bluetooth access is not authorized"
        case .bluetoothUnsupported:
            return "Bluetooth is not supported on this device"
        case .locationUnauthorized:
            return "Location access is required for proximity detection"
        case .scanningFailed:
            return "Failed to start proximity scanning"
        }
    }
}

// MARK: - Bluetooth Permission Checking

extension ProximityDetectionService {
    private func checkBluetoothPermissions() -> Bool {
        switch CBCentralManager.authorization {
        case .allowedAlways:
            return true
        case .denied, .restricted:
            delegate?.proximityDetectionDidFail(error: .bluetoothUnauthorized)
            return false
        case .notDetermined:
            // Will prompt for permission
            return true
        @unknown default:
            return false
        }
    }
}