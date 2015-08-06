contract('TerraNullius', function(accounts) {
  it("lets you stake a claim", function(done) {
    var tn = TerraNullius.at(TerraNullius.deployed_address);

    tn.claim("Kilroy was here.").
    then(function() { return tn.number_of_claims.call() }).
    then(function(result) { assert.equal(result, 1) }).
    then(function() { return tn.claims.call(0) } ).
    then(function(result) {
      assert.equal(result[0], accounts[0]);
      assert.equal(result[1], "Kilroy was here.");
      assert.isAbove(result[2], 0);
      done();
    }).catch(done)
  });
});
