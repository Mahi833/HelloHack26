#import "IcupMotion.h"

#import <CoreMotion/CoreMotion.h>

static const NSTimeInterval IcupMotionMinInterval = 1.0 / 120.0;
static const NSTimeInterval IcupMotionMaxInterval = 1.0;

@implementation IcupMotion {
  CMMotionManager *_manager;
  NSOperationQueue *_queue;
}

RCT_EXPORT_MODULE()

- (instancetype)init
{
  if (self = [super init]) {
    _manager = [CMMotionManager new];
    _queue = [NSOperationQueue new];
    _queue.name = @"com.alexliu.icup.motion";
    _queue.maxConcurrentOperationCount = 1;
    _queue.qualityOfService = NSQualityOfServiceUserInteractive;
  }
  return self;
}

- (void)dealloc
{
  [_manager stopDeviceMotionUpdates];
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSNumber *)isAvailable
{
  return @(_manager.deviceMotionAvailable);
}

- (void)start:(double)intervalMs
{
  if (!_manager.deviceMotionAvailable) {
    return;
  }

  NSTimeInterval requested = intervalMs / 1000.0;
  NSTimeInterval interval = MIN(MAX(requested, IcupMotionMinInterval), IcupMotionMaxInterval);
  _manager.deviceMotionUpdateInterval = interval;

  if (_manager.deviceMotionActive) {
    return;
  }

  __weak __typeof(self) weakSelf = self;
  [_manager startDeviceMotionUpdatesToQueue:_queue
                               withHandler:^(CMDeviceMotion *_Nullable motion, NSError *_Nullable error) {
    __typeof(self) strongSelf = weakSelf;
    if (strongSelf == nil || motion == nil) {
      return;
    }
    CMAcceleration gravity = motion.gravity;
    [strongSelf emitOnGravity:@{@"x" : @(gravity.x), @"y" : @(gravity.y), @"z" : @(gravity.z)}];
  }];
}

- (void)stop
{
  [_manager stopDeviceMotionUpdates];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeIcupMotionSpecJSI>(params);
}

@end
