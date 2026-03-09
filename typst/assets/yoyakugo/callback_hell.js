// コールバック地獄（Promise 普及以前の JavaScript）
fetch('/api/user', function(data) {
  parse('/api/order', data, function(order) {
    calc('/api/item', order, function(item) {
      // ネストが深くなる一方...
    });
  });
});
